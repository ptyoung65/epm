const { spawn, exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Playwright 스크립트 실행 서비스
 */
class PlaywrightExecutorService {
  constructor() {
    this.executionsDir = path.join(process.cwd(), 'executions');
    this.runningExecutions = new Map();
    this.ensureExecutionsDirectory();
  }

  async ensureExecutionsDirectory() {
    try {
      await fs.ensureDir(this.executionsDir);
    } catch (error) {
      logger.error('실행 디렉토리 생성 실패:', error);
      throw error;
    }
  }

  /**
   * Playwright 스크립트 실행
   */
  async executeScript(scriptPath, options = {}) {
    const executionId = uuidv4();
    const timestamp = new Date().toISOString();
    
    const execution = {
      id: executionId,
      scriptPath,
      status: 'starting',
      startTime: timestamp,
      options,
      logs: [],
      screenshots: [],
      videos: [],
      error: null
    };

    this.runningExecutions.set(executionId, execution);

    try {
      await this.runPlaywrightScript(execution);
      return executionId;
    } catch (error) {
      execution.status = 'failed';
      execution.error = error.message;
      logger.error(`스크립트 실행 실패: ${executionId}`, error);
      throw error;
    }
  }

  /**
   * Playwright 스크립트 실제 실행
   */
  async runPlaywrightScript(execution) {
    const {
      browser = 'chromium',
      headless = true,
      video = true,
      screenshots = true,
      tracing = true,
      timeout = 60000
    } = execution.options;

    const outputDir = path.join(this.executionsDir, execution.id);
    await fs.ensureDir(outputDir);

    // Playwright 설정
    const playwrightConfig = {
      use: {
        headless,
        video: video ? 'retain-on-failure' : 'off',
        screenshot: screenshots ? 'only-on-failure' : 'off',
        trace: tracing ? 'retain-on-failure' : 'off'
      },
      projects: [
        {
          name: browser,
          use: { ...require(`@playwright/test`).devices[this.getDeviceName(browser)] }
        }
      ],
      outputDir,
      testTimeout: timeout
    };

    const configPath = path.join(outputDir, 'playwright.config.js');
    await fs.writeFile(configPath, `module.exports = ${JSON.stringify(playwrightConfig, null, 2)};`);

    return new Promise((resolve, reject) => {
      execution.status = 'running';
      
      // Playwright 테스트 실행
      const command = 'npx';
      const args = [
        'playwright', 'test',
        execution.scriptPath,
        '--config', configPath,
        '--reporter=json'
      ];

      if (execution.options.debug) {
        args.push('--debug');
      }

      const child = spawn(command, args, {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      execution.process = child;

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        execution.logs.push({
          type: 'stdout',
          message: output,
          timestamp: new Date().toISOString()
        });
      });

      child.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        execution.logs.push({
          type: 'stderr', 
          message: output,
          timestamp: new Date().toISOString()
        });
      });

      child.on('close', async (code) => {
        execution.endTime = new Date().toISOString();
        execution.exitCode = code;

        if (code === 0) {
          execution.status = 'completed';
          
          // 결과 파일들 수집
          await this.collectExecutionArtifacts(execution, outputDir);
          
          logger.info(`스크립트 실행 완료: ${execution.id}`);
          resolve(execution);
        } else {
          execution.status = 'failed';
          execution.error = stderr || '알 수 없는 오류';
          
          logger.error(`스크립트 실행 실패: ${execution.id}, 종료 코드: ${code}`);
          reject(new Error(`스크립트 실행 실패: ${execution.error}`));
        }

        // 프로세스 참조 제거
        delete execution.process;
      });

      child.on('error', (error) => {
        execution.status = 'failed';
        execution.error = error.message;
        execution.endTime = new Date().toISOString();
        
        logger.error(`스크립트 실행 오류: ${execution.id}`, error);
        reject(error);
      });

      // 타임아웃 설정
      setTimeout(() => {
        if (execution.status === 'running') {
          this.stopExecution(execution.id);
          reject(new Error('실행 시간 초과'));
        }
      }, timeout + 10000); // 여유시간 추가
    });
  }

  /**
   * 실행 결과물 수집
   */
  async collectExecutionArtifacts(execution, outputDir) {
    try {
      // 스크린샷 수집
      const screenshotsDir = path.join(outputDir, 'screenshots');
      if (await fs.pathExists(screenshotsDir)) {
        const screenshots = await fs.readdir(screenshotsDir);
        execution.screenshots = screenshots.map(file => 
          path.join(screenshotsDir, file)
        );
      }

      // 비디오 수집
      const videosDir = path.join(outputDir, 'videos');
      if (await fs.pathExists(videosDir)) {
        const videos = await fs.readdir(videosDir);
        execution.videos = videos.map(file => 
          path.join(videosDir, file)
        );
      }

      // 트레이스 수집
      const tracesDir = path.join(outputDir, 'traces');
      if (await fs.pathExists(tracesDir)) {
        const traces = await fs.readdir(tracesDir);
        execution.traces = traces.map(file => 
          path.join(tracesDir, file)
        );
      }

      // 테스트 리포트 수집
      const reportFile = path.join(outputDir, 'results.json');
      if (await fs.pathExists(reportFile)) {
        execution.report = await fs.readJson(reportFile);
      }

    } catch (error) {
      logger.warn('실행 결과물 수집 중 오류:', error);
    }
  }

  /**
   * 실행 중인 스크립트 중지
   */
  async stopExecution(executionId) {
    const execution = this.runningExecutions.get(executionId);
    
    if (!execution) {
      throw new Error(`실행을 찾을 수 없습니다: ${executionId}`);
    }

    if (execution.process) {
      execution.process.kill('SIGTERM');
      execution.status = 'stopped';
      execution.endTime = new Date().toISOString();
      execution.error = '사용자에 의해 중지됨';
      
      logger.info(`스크립트 실행 중지: ${executionId}`);
    }

    return execution;
  }

  /**
   * 실행 상태 조회
   */
  getExecution(executionId) {
    return this.runningExecutions.get(executionId);
  }

  /**
   * 모든 실행 목록 조회
   */
  getAllExecutions() {
    return Array.from(this.runningExecutions.values());
  }

  /**
   * 실행 기록 삭제
   */
  async deleteExecution(executionId) {
    const execution = this.runningExecutions.get(executionId);
    
    if (execution) {
      // 실행 중이면 먼저 중지
      if (execution.status === 'running') {
        await this.stopExecution(executionId);
      }

      // 결과 파일들 삭제
      const outputDir = path.join(this.executionsDir, executionId);
      if (await fs.pathExists(outputDir)) {
        await fs.remove(outputDir);
      }

      // 메모리에서 제거
      this.runningExecutions.delete(executionId);
      
      logger.info(`실행 기록 삭제: ${executionId}`);
      return true;
    }

    return false;
  }

  /**
   * 실행 로그 스트림
   */
  getExecutionLogs(executionId) {
    const execution = this.getExecution(executionId);
    return execution ? execution.logs : [];
  }

  /**
   * 실행 아티팩트 파일 경로 조회
   */
  getArtifactPath(executionId, artifactType, fileName) {
    const outputDir = path.join(this.executionsDir, executionId);
    
    switch (artifactType) {
      case 'screenshot':
        return path.join(outputDir, 'screenshots', fileName);
      case 'video':
        return path.join(outputDir, 'videos', fileName);
      case 'trace':
        return path.join(outputDir, 'traces', fileName);
      default:
        return path.join(outputDir, fileName);
    }
  }

  /**
   * 브라우저별 디바이스 이름 매핑
   */
  getDeviceName(browser) {
    const deviceMap = {
      chromium: 'Desktop Chrome',
      firefox: 'Desktop Firefox',
      webkit: 'Desktop Safari'
    };
    
    return deviceMap[browser] || 'Desktop Chrome';
  }

  /**
   * 실행 통계
   */
  getExecutionStats() {
    const executions = Array.from(this.runningExecutions.values());
    
    return {
      total: executions.length,
      running: executions.filter(e => e.status === 'running').length,
      completed: executions.filter(e => e.status === 'completed').length,
      failed: executions.filter(e => e.status === 'failed').length,
      stopped: executions.filter(e => e.status === 'stopped').length,
      recent: executions
        .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
        .slice(0, 10)
    };
  }

  /**
   * 정리 작업 (오래된 실행 기록 제거)
   */
  async cleanup(maxAge = 24 * 60 * 60 * 1000) { // 24시간
    const now = new Date();
    const toDelete = [];

    for (const [id, execution] of this.runningExecutions.entries()) {
      if (execution.endTime) {
        const endTime = new Date(execution.endTime);
        if (now - endTime > maxAge) {
          toDelete.push(id);
        }
      }
    }

    for (const id of toDelete) {
      await this.deleteExecution(id);
    }

    logger.info(`정리 작업 완료: ${toDelete.length}개 실행 기록 삭제`);
    return toDelete.length;
  }
}

module.exports = PlaywrightExecutorService;