const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * rrweb 이벤트를 Playwright 스크립트로 변환하는 서비스
 */
class PlaywrightConverterService {
  constructor() {
    this.scriptsDir = path.join(process.cwd(), 'playwright-scripts');
    this.ensureScriptsDirectory();
  }

  async ensureScriptsDirectory() {
    try {
      await fs.ensureDir(this.scriptsDir);
    } catch (error) {
      logger.error('스크립트 디렉토리 생성 실패:', error);
      throw error;
    }
  }

  /**
   * rrweb 세션 데이터를 Playwright 스크립트로 변환
   */
  async convertSession(sessionData, options = {}) {
    try {
      const { session, events } = sessionData;
      const scriptId = uuidv4();
      const scriptFile = path.join(this.scriptsDir, `${scriptId}.js`);

      // 이벤트 분석 및 변환
      const actions = this.analyzeEvents(events);
      
      // Playwright 스크립트 생성
      const script = this.generatePlaywrightScript(session, actions, options);
      
      await fs.writeFile(scriptFile, script);

      const scriptInfo = {
        id: scriptId,
        sessionId: session.id,
        fileName: `${scriptId}.js`,
        filePath: scriptFile,
        url: session.url,
        createdAt: new Date().toISOString(),
        actionsCount: actions.length,
        metadata: {
          originalDuration: session.duration,
          viewport: session.metadata.viewport,
          device: session.metadata.device,
          browser: session.metadata.browser
        },
        options
      };

      logger.info(`Playwright 스크립트 생성 완료: ${scriptId}`);
      return scriptInfo;
    } catch (error) {
      logger.error('Playwright 변환 실패:', error);
      throw error;
    }
  }

  /**
   * rrweb 이벤트를 분석하여 Playwright 액션으로 변환
   */
  analyzeEvents(events) {
    const actions = [];
    let currentUrl = null;

    for (const event of events) {
      switch (event.type) {
        case 0: // EventType.DomContentLoaded
          if (event.data && event.data.href) {
            currentUrl = event.data.href;
            actions.push({
              type: 'navigation',
              url: currentUrl,
              timestamp: event.timestamp
            });
          }
          break;

        case 2: // EventType.FullSnapshot
          // 전체 스냅샷은 페이지 로드로 처리
          if (event.data && event.data.node) {
            actions.push({
              type: 'waitForSelector',
              selector: 'body',
              timestamp: event.timestamp
            });
          }
          break;

        case 3: // EventType.IncrementalSnapshot
          const incrementalAction = this.processIncrementalSnapshot(event);
          if (incrementalAction) {
            actions.push(incrementalAction);
          }
          break;

        case 4: // EventType.Meta
          // 메타데이터는 스킵
          break;

        case 5: // EventType.Custom
          const customAction = this.processCustomEvent(event);
          if (customAction) {
            actions.push(customAction);
          }
          break;
      }
    }

    return this.optimizeActions(actions);
  }

  /**
   * IncrementalSnapshot 이벤트 처리
   */
  processIncrementalSnapshot(event) {
    if (!event.data) return null;

    switch (event.data.source) {
      case 0: // IncrementalSource.Mutation
        return this.processMutation(event);
      
      case 1: // IncrementalSource.MouseMove
        return {
          type: 'mouseMove',
          x: event.data.positions?.[0]?.x || 0,
          y: event.data.positions?.[0]?.y || 0,
          timestamp: event.timestamp
        };

      case 2: // IncrementalSource.MouseInteraction
        return this.processMouseInteraction(event);

      case 3: // IncrementalSource.Scroll
        return {
          type: 'scroll',
          x: event.data.x || 0,
          y: event.data.y || 0,
          timestamp: event.timestamp
        };

      case 4: // IncrementalSource.ViewportResize
        return {
          type: 'resize',
          width: event.data.width,
          height: event.data.height,
          timestamp: event.timestamp
        };

      case 5: // IncrementalSource.Input
        return {
          type: 'input',
          selector: this.getElementSelector(event.data.id),
          text: event.data.text,
          timestamp: event.timestamp
        };

      default:
        return null;
    }
  }

  /**
   * 마우스 상호작용 처리
   */
  processMouseInteraction(event) {
    const { type, x, y, id } = event.data;
    const selector = this.getElementSelector(id);

    switch (type) {
      case 0: // MouseUp
      case 1: // MouseDown
        return {
          type: 'click',
          selector,
          x,
          y,
          timestamp: event.timestamp
        };
      
      case 2: // Click
        return {
          type: 'click',
          selector,
          x,
          y,
          timestamp: event.timestamp
        };

      case 3: // ContextMenu
        return {
          type: 'contextMenu',
          selector,
          x,
          y,
          timestamp: event.timestamp
        };

      case 4: // DblClick
        return {
          type: 'dblclick',
          selector,
          x,
          y,
          timestamp: event.timestamp
        };

      default:
        return null;
    }
  }

  /**
   * DOM 변경 처리
   */
  processMutation(event) {
    // DOM 변경은 대부분 부수효과이므로 일단 스킵
    // 필요시 특정 변경만 처리하도록 확장 가능
    return null;
  }

  /**
   * 커스텀 이벤트 처리
   */
  processCustomEvent(event) {
    if (event.data && event.data.tag === 'playwright') {
      return {
        type: 'custom',
        action: event.data.payload,
        timestamp: event.timestamp
      };
    }
    return null;
  }

  /**
   * 엘리먼트 ID를 CSS 선택자로 변환
   */
  getElementSelector(id) {
    // 실제로는 rrweb의 노드 ID를 CSS 선택자로 변환하는 로직이 필요
    // 현재는 간단한 구현
    return `[data-rr-id="${id}"]`;
  }

  /**
   * 액션 최적화 (중복 제거, 순서 정리 등)
   */
  optimizeActions(actions) {
    const optimized = [];
    let lastAction = null;

    for (const action of actions) {
      // 연속된 마우스 이동은 마지막 것만 유지
      if (action.type === 'mouseMove' && lastAction?.type === 'mouseMove') {
        optimized[optimized.length - 1] = action;
      }
      // 중복 클릭 제거
      else if (action.type === 'click' && lastAction?.type === 'click' &&
               action.selector === lastAction.selector &&
               Math.abs(action.timestamp - lastAction.timestamp) < 500) {
        continue;
      }
      else {
        optimized.push(action);
      }
      
      lastAction = action;
    }

    return optimized;
  }

  /**
   * Playwright 스크립트 생성
   */
  generatePlaywrightScript(session, actions, options) {
    const {
      browser = 'chromium',
      headless = true,
      slowMo = 100,
      timeout = 30000,
      viewport = session.metadata.viewport
    } = options;

    let script = `const { test, expect, ${browser} } = require('@playwright/test');

// Auto-generated Playwright script from rrweb session
// Session ID: ${session.id}
// Original URL: ${session.url}
// Duration: ${session.duration}ms
// Generated: ${new Date().toISOString()}

test('Replay session ${session.id}', async () => {
  const browser = await ${browser}.launch({ 
    headless: ${headless},
    slowMo: ${slowMo}
  });
  
  const context = await browser.newContext({
    viewport: ${JSON.stringify(viewport || { width: 1920, height: 1080 })},
    userAgent: '${session.userAgent || 'Mozilla/5.0 (compatible; AIRIS-APM Session Replay)'}'
  });
  
  const page = await context.newPage();
  page.setDefaultTimeout(${timeout});

  try {
`;

    // 액션들을 Playwright 코드로 변환
    for (const action of actions) {
      script += this.generateActionCode(action);
    }

    script += `
    // 세션 완료 후 잠시 대기
    await page.waitForTimeout(1000);
    
  } catch (error) {
    console.error('Replay failed:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
});

// 개별 액션 실행 함수들
async function waitForElement(page, selector, timeout = 5000) {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch (error) {
    console.warn(\`Element not found: \${selector}\`);
    return false;
  }
}

async function safeClick(page, selector, x, y) {
  try {
    if (await waitForElement(page, selector)) {
      await page.click(selector, { position: { x, y } });
    } else {
      await page.click({ position: { x, y } });
    }
  } catch (error) {
    console.warn(\`Click failed at \${selector} (\${x}, \${y})\`);
  }
}

async function safeType(page, selector, text) {
  try {
    if (await waitForElement(page, selector)) {
      await page.fill(selector, text);
    }
  } catch (error) {
    console.warn(\`Type failed at \${selector}: \${text}\`);
  }
}
`;

    return script;
  }

  /**
   * 개별 액션을 Playwright 코드로 변환
   */
  generateActionCode(action) {
    const indent = '    ';
    
    switch (action.type) {
      case 'navigation':
        return `${indent}await page.goto('${action.url}');\n${indent}await page.waitForLoadState('domcontentloaded');\n\n`;

      case 'click':
        return `${indent}await safeClick(page, '${action.selector}', ${action.x || 0}, ${action.y || 0});\n${indent}await page.waitForTimeout(100);\n\n`;

      case 'dblclick':
        return `${indent}await page.dblclick('${action.selector}');\n${indent}await page.waitForTimeout(100);\n\n`;

      case 'input':
        return `${indent}await safeType(page, '${action.selector}', '${action.text}');\n${indent}await page.waitForTimeout(100);\n\n`;

      case 'scroll':
        return `${indent}await page.evaluate(() => window.scrollTo(${action.x}, ${action.y}));\n${indent}await page.waitForTimeout(100);\n\n`;

      case 'resize':
        return `${indent}await page.setViewportSize({ width: ${action.width}, height: ${action.height} });\n\n`;

      case 'waitForSelector':
        return `${indent}await page.waitForSelector('${action.selector}');\n\n`;

      case 'mouseMove':
        return `${indent}await page.mouse.move(${action.x}, ${action.y});\n`;

      case 'contextMenu':
        return `${indent}await page.click('${action.selector}', { button: 'right' });\n${indent}await page.waitForTimeout(100);\n\n`;

      default:
        return `${indent}// Unknown action: ${action.type}\n`;
    }
  }

  /**
   * 스크립트 파일 조회
   */
  async getScript(scriptId) {
    try {
      const scriptFile = path.join(this.scriptsDir, `${scriptId}.js`);
      
      if (!(await fs.pathExists(scriptFile))) {
        throw new Error(`스크립트를 찾을 수 없습니다: ${scriptId}`);
      }

      const content = await fs.readFile(scriptFile, 'utf8');
      return {
        id: scriptId,
        fileName: `${scriptId}.js`,
        content,
        size: content.length
      };
    } catch (error) {
      logger.error('스크립트 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 스크립트 파일 삭제
   */
  async deleteScript(scriptId) {
    try {
      const scriptFile = path.join(this.scriptsDir, `${scriptId}.js`);
      
      if (await fs.pathExists(scriptFile)) {
        await fs.remove(scriptFile);
        logger.info(`스크립트 삭제 완료: ${scriptId}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('스크립트 삭제 실패:', error);
      throw error;
    }
  }
}

module.exports = PlaywrightConverterService;