const express = require('express');
const { exec, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const execAsync = promisify(exec);

const router = express.Router();

// 서버 설정 데이터 저장 경로
const SERVER_CONFIG_DIR = path.join(__dirname, '../../data/servers');
const SERVER_CONFIG_FILE = path.join(SERVER_CONFIG_DIR, 'servers.json');
const SCRIPT_DIR = path.join(__dirname, '../../../../../scripts');

// 데이터 디렉토리 생성
async function ensureDataDirectory() {
    try {
        await fs.mkdir(SERVER_CONFIG_DIR, { recursive: true });
        
        // servers.json 파일이 없으면 생성
        try {
            await fs.access(SERVER_CONFIG_FILE);
        } catch {
            await fs.writeFile(SERVER_CONFIG_FILE, JSON.stringify({ servers: [] }, null, 2));
        }
    } catch (error) {
        console.error('Failed to create data directory:', error);
    }
}

// 서버 설정 데이터 로드
async function loadServerConfigs() {
    try {
        await ensureDataDirectory();
        const data = await fs.readFile(SERVER_CONFIG_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Failed to load server configs:', error);
        return { servers: [] };
    }
}

// 서버 설정 데이터 저장
async function saveServerConfigs(data) {
    try {
        await ensureDataDirectory();
        await fs.writeFile(SERVER_CONFIG_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Failed to save server configs:', error);
        return false;
    }
}

// 고유 ID 생성
function generateId() {
    return crypto.randomBytes(8).toString('hex');
}

/**
 * @swagger
 * components:
 *   schemas:
 *     Server:
 *       type: object
 *       required:
 *         - name
 *         - host
 *         - type
 *       properties:
 *         id:
 *           type: string
 *           description: 서버 고유 ID
 *         name:
 *           type: string
 *           description: 서버 이름
 *         host:
 *           type: string
 *           description: 서버 호스트명 또는 IP
 *         port:
 *           type: integer
 *           description: SSH 포트
 *           default: 22
 *         username:
 *           type: string
 *           description: SSH 사용자명
 *         keyPath:
 *           type: string
 *           description: SSH 키 파일 경로
 *         type:
 *           type: string
 *           enum: [app, db, web, was, system]
 *           description: 서버 타입
 *         subtype:
 *           type: string
 *           description: 서버 세부 타입 (nodejs, java, mysql, nginx 등)
 *         airisEndpoint:
 *           type: string
 *           description: AIRIS-MON 서버 엔드포인트
 *         components:
 *           type: array
 *           items:
 *             type: string
 *           description: 설치할 컴포넌트 목록
 *         status:
 *           type: string
 *           enum: [unknown, online, offline, installing, error]
 *           description: 서버 상태
 *         lastCheck:
 *           type: string
 *           format: date-time
 *           description: 마지막 상태 확인 시간
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 생성 시간
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 수정 시간
 */

/**
 * @swagger
 * /api/servers:
 *   get:
 *     summary: 서버 목록 조회
 *     tags: [Server Management]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: 서버 타입 필터
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: 서버 상태 필터
 *     responses:
 *       200:
 *         description: 서버 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Server'
 */
router.get('/', async (req, res) => {
    try {
        const { type, status } = req.query;
        const configs = await loadServerConfigs();
        let servers = configs.servers || [];

        // 필터 적용
        if (type) {
            servers = servers.filter(server => server.type === type);
        }
        if (status) {
            servers = servers.filter(server => server.status === status);
        }

        res.json({
            success: true,
            data: servers,
            total: servers.length
        });
    } catch (error) {
        console.error('Failed to get servers:', error);
        res.status(500).json({
            success: false,
            message: '서버 목록 조회에 실패했습니다',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/servers/{id}:
 *   get:
 *     summary: 특정 서버 정보 조회
 *     tags: [Server Management]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 서버 ID
 *     responses:
 *       200:
 *         description: 서버 정보
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Server'
 *       404:
 *         description: 서버를 찾을 수 없음
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const configs = await loadServerConfigs();
        const server = configs.servers.find(s => s.id === id);

        if (!server) {
            return res.status(404).json({
                success: false,
                message: '서버를 찾을 수 없습니다'
            });
        }

        res.json({
            success: true,
            data: server
        });
    } catch (error) {
        console.error('Failed to get server:', error);
        res.status(500).json({
            success: false,
            message: '서버 정보 조회에 실패했습니다',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/servers:
 *   post:
 *     summary: 새 서버 등록
 *     tags: [Server Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - host
 *               - username
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *               host:
 *                 type: string
 *               port:
 *                 type: integer
 *                 default: 22
 *               username:
 *                 type: string
 *               keyPath:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [app, db, web, was, system]
 *               subtype:
 *                 type: string
 *               airisEndpoint:
 *                 type: string
 *               components:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: 서버 등록 성공
 *       400:
 *         description: 잘못된 요청
 */
router.post('/', async (req, res) => {
    try {
        const {
            name,
            host,
            port = 22,
            username,
            keyPath,
            type,
            subtype,
            airisEndpoint = 'http://localhost:4317',
            components = []
        } = req.body;

        // 필수 필드 검증
        if (!name || !host || !username || !type) {
            return res.status(400).json({
                success: false,
                message: '필수 필드가 누락되었습니다 (name, host, username, type)'
            });
        }

        const configs = await loadServerConfigs();
        
        // 중복 확인
        const existingServer = configs.servers.find(s => s.name === name || (s.host === host && s.username === username));
        if (existingServer) {
            return res.status(400).json({
                success: false,
                message: '동일한 이름 또는 호스트/사용자 조합의 서버가 이미 존재합니다'
            });
        }

        const newServer = {
            id: generateId(),
            name,
            host,
            port,
            username,
            keyPath,
            type,
            subtype,
            airisEndpoint,
            components,
            status: 'unknown',
            lastCheck: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        configs.servers.push(newServer);
        await saveServerConfigs(configs);

        res.status(201).json({
            success: true,
            data: newServer,
            message: '서버가 성공적으로 등록되었습니다'
        });
    } catch (error) {
        console.error('Failed to create server:', error);
        res.status(500).json({
            success: false,
            message: '서버 등록에 실패했습니다',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/servers/{id}:
 *   put:
 *     summary: 서버 정보 수정
 *     tags: [Server Management]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               host:
 *                 type: string
 *               port:
 *                 type: integer
 *               username:
 *                 type: string
 *               keyPath:
 *                 type: string
 *               type:
 *                 type: string
 *               subtype:
 *                 type: string
 *               airisEndpoint:
 *                 type: string
 *               components:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: 서버 정보 수정 성공
 *       404:
 *         description: 서버를 찾을 수 없음
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const configs = await loadServerConfigs();
        const serverIndex = configs.servers.findIndex(s => s.id === id);

        if (serverIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '서버를 찾을 수 없습니다'
            });
        }

        // 업데이트
        configs.servers[serverIndex] = {
            ...configs.servers[serverIndex],
            ...updateData,
            updatedAt: new Date().toISOString()
        };

        await saveServerConfigs(configs);

        res.json({
            success: true,
            data: configs.servers[serverIndex],
            message: '서버 정보가 성공적으로 수정되었습니다'
        });
    } catch (error) {
        console.error('Failed to update server:', error);
        res.status(500).json({
            success: false,
            message: '서버 정보 수정에 실패했습니다',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/servers/{id}:
 *   delete:
 *     summary: 서버 삭제
 *     tags: [Server Management]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 서버 삭제 성공
 *       404:
 *         description: 서버를 찾을 수 없음
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const configs = await loadServerConfigs();
        const serverIndex = configs.servers.findIndex(s => s.id === id);

        if (serverIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '서버를 찾을 수 없습니다'
            });
        }

        const deletedServer = configs.servers.splice(serverIndex, 1)[0];
        await saveServerConfigs(configs);

        res.json({
            success: true,
            data: deletedServer,
            message: '서버가 성공적으로 삭제되었습니다'
        });
    } catch (error) {
        console.error('Failed to delete server:', error);
        res.status(500).json({
            success: false,
            message: '서버 삭제에 실패했습니다',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/servers/{id}/check-connection:
 *   post:
 *     summary: 서버 연결 테스트
 *     tags: [Server Management]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 연결 테스트 결과
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 connected:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 details:
 *                   type: object
 */
router.post('/:id/check-connection', async (req, res) => {
    try {
        const { id } = req.params;
        const configs = await loadServerConfigs();
        const server = configs.servers.find(s => s.id === id);

        if (!server) {
            return res.status(404).json({
                success: false,
                message: '서버를 찾을 수 없습니다'
            });
        }

        // SSH 연결 테스트
        const scriptPath = path.join(SCRIPT_DIR, 'remote-server-setup.sh');
        let command = `bash "${scriptPath}" info -h ${server.host} -u ${server.username} -p ${server.port}`;
        
        if (server.keyPath) {
            command += ` -k "${server.keyPath}"`;
        }

        try {
            const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
            
            // 서버 상태 업데이트
            const serverIndex = configs.servers.findIndex(s => s.id === id);
            configs.servers[serverIndex].status = 'online';
            configs.servers[serverIndex].lastCheck = new Date().toISOString();
            await saveServerConfigs(configs);

            res.json({
                success: true,
                connected: true,
                message: '서버 연결에 성공했습니다',
                details: {
                    stdout: stdout.trim(),
                    timestamp: new Date().toISOString()
                }
            });
        } catch (execError) {
            // 서버 상태 업데이트
            const serverIndex = configs.servers.findIndex(s => s.id === id);
            configs.servers[serverIndex].status = 'offline';
            configs.servers[serverIndex].lastCheck = new Date().toISOString();
            await saveServerConfigs(configs);

            res.json({
                success: true,
                connected: false,
                message: '서버 연결에 실패했습니다',
                details: {
                    error: execError.message,
                    timestamp: new Date().toISOString()
                }
            });
        }
    } catch (error) {
        console.error('Failed to check connection:', error);
        res.status(500).json({
            success: false,
            message: '연결 테스트에 실패했습니다',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/servers/{id}/install:
 *   post:
 *     summary: 서버에 모니터링 에이전트 설치
 *     tags: [Server Management]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               components:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 설치할 컴포넌트 목록
 *               force:
 *                 type: boolean
 *                 description: 강제 재설치 여부
 *     responses:
 *       200:
 *         description: 설치 작업 시작됨
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 jobId:
 *                   type: string
 *                 message:
 *                   type: string
 */
router.post('/:id/install', async (req, res) => {
    try {
        const { id } = req.params;
        const { components, force = false } = req.body;
        
        const configs = await loadServerConfigs();
        const server = configs.servers.find(s => s.id === id);

        if (!server) {
            return res.status(404).json({
                success: false,
                message: '서버를 찾을 수 없습니다'
            });
        }

        // 설치 작업 ID 생성
        const jobId = generateId();
        
        // 서버 상태 업데이트
        const serverIndex = configs.servers.findIndex(s => s.id === id);
        configs.servers[serverIndex].status = 'installing';
        configs.servers[serverIndex].lastInstall = {
            jobId,
            startTime: new Date().toISOString(),
            components: components || server.components,
            force
        };
        await saveServerConfigs(configs);

        // 백그라운드에서 설치 실행
        installMonitoringAgents(server, components || server.components, force, jobId);

        res.json({
            success: true,
            jobId,
            message: '모니터링 에이전트 설치가 시작되었습니다',
            server: configs.servers[serverIndex]
        });
    } catch (error) {
        console.error('Failed to start installation:', error);
        res.status(500).json({
            success: false,
            message: '설치 작업 시작에 실패했습니다',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/servers/{id}/install-status/{jobId}:
 *   get:
 *     summary: 설치 작업 상태 조회
 *     tags: [Server Management]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 설치 작업 상태
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 status:
 *                   type: string
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: string
 *                 progress:
 *                   type: number
 */
router.get('/:id/install-status/:jobId', async (req, res) => {
    try {
        const { id, jobId } = req.params;
        
        // 설치 로그 파일 경로
        const logFile = path.join(SERVER_CONFIG_DIR, `install-${jobId}.log`);
        const statusFile = path.join(SERVER_CONFIG_DIR, `install-${jobId}.status`);
        
        let logs = [];
        let status = 'running';
        let progress = 0;
        
        try {
            // 로그 파일 읽기
            const logData = await fs.readFile(logFile, 'utf8');
            logs = logData.split('\n').filter(line => line.trim());
            
            // 상태 파일 읽기
            const statusData = await fs.readFile(statusFile, 'utf8');
            const statusInfo = JSON.parse(statusData);
            status = statusInfo.status;
            progress = statusInfo.progress || 0;
        } catch (error) {
            // 파일이 없으면 아직 시작하지 않았거나 완료됨
        }
        
        res.json({
            success: true,
            jobId,
            status,
            progress,
            logs: logs.slice(-50), // 최근 50줄만 반환
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Failed to get install status:', error);
        res.status(500).json({
            success: false,
            message: '설치 상태 조회에 실패했습니다',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/servers/bulk-check:
 *   post:
 *     summary: 여러 서버 상태 일괄 확인
 *     tags: [Server Management]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               serverIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: 일괄 상태 확인 결과
 */
router.post('/bulk-check', async (req, res) => {
    try {
        const { serverIds } = req.body;
        
        if (!Array.isArray(serverIds)) {
            return res.status(400).json({
                success: false,
                message: 'serverIds는 배열이어야 합니다'
            });
        }

        const configs = await loadServerConfigs();
        const results = [];

        // 병렬로 연결 테스트 실행
        const checkPromises = serverIds.map(async (serverId) => {
            const server = configs.servers.find(s => s.id === serverId);
            if (!server) {
                return { id: serverId, status: 'not_found' };
            }

            try {
                const scriptPath = path.join(SCRIPT_DIR, 'remote-server-setup.sh');
                let command = `bash "${scriptPath}" info -h ${server.host} -u ${server.username} -p ${server.port}`;
                
                if (server.keyPath) {
                    command += ` -k "${server.keyPath}"`;
                }

                await execAsync(command, { timeout: 15000 });
                
                // 서버 상태 업데이트
                const serverIndex = configs.servers.findIndex(s => s.id === serverId);
                configs.servers[serverIndex].status = 'online';
                configs.servers[serverIndex].lastCheck = new Date().toISOString();
                
                return { id: serverId, status: 'online', server: configs.servers[serverIndex] };
            } catch (error) {
                // 서버 상태 업데이트
                const serverIndex = configs.servers.findIndex(s => s.id === serverId);
                configs.servers[serverIndex].status = 'offline';
                configs.servers[serverIndex].lastCheck = new Date().toISOString();
                
                return { id: serverId, status: 'offline', error: error.message };
            }
        });

        const checkResults = await Promise.all(checkPromises);
        await saveServerConfigs(configs);

        res.json({
            success: true,
            results: checkResults,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Failed to bulk check servers:', error);
        res.status(500).json({
            success: false,
            message: '일괄 상태 확인에 실패했습니다',
            error: error.message
        });
    }
});

// 백그라운드 설치 함수
async function installMonitoringAgents(server, components, force, jobId) {
    const logFile = path.join(SERVER_CONFIG_DIR, `install-${jobId}.log`);
    const statusFile = path.join(SERVER_CONFIG_DIR, `install-${jobId}.status`);
    
    try {
        // 상태 파일 초기화
        await fs.writeFile(statusFile, JSON.stringify({
            status: 'running',
            progress: 0,
            startTime: new Date().toISOString()
        }));

        const scriptPath = path.join(SCRIPT_DIR, 'remote-server-setup.sh');
        let command = `bash "${scriptPath}" install -h ${server.host} -u ${server.username} -p ${server.port}`;
        
        if (server.keyPath) {
            command += ` -k "${server.keyPath}"`;
        }
        if (server.airisEndpoint) {
            command += ` -a "${server.airisEndpoint}"`;
        }
        if (components && components.length > 0) {
            command += ` -c "${components.join(',')}"`;
        }

        // 로그 파일 초기화
        await fs.writeFile(logFile, `Starting installation for server: ${server.name}\nCommand: ${command}\n`);

        // 설치 스크립트 실행
        const childProcess = spawn('bash', [scriptPath, 'install', 
            '-h', server.host, 
            '-u', server.username, 
            '-p', server.port.toString(),
            ...(server.keyPath ? ['-k', server.keyPath] : []),
            ...(server.airisEndpoint ? ['-a', server.airisEndpoint] : []),
            ...(components && components.length > 0 ? ['-c', components.join(',')] : [])
        ], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        // 실시간 로그 수집
        childProcess.stdout.on('data', async (data) => {
            const logData = data.toString();
            await fs.appendFile(logFile, logData);
            
            // 진행률 추정 (간단한 키워드 기반)
            let progress = 10;
            if (logData.includes('설치 완료') || logData.includes('installation complete')) {
                progress = 90;
            } else if (logData.includes('설정') || logData.includes('config')) {
                progress = 70;
            } else if (logData.includes('다운로드') || logData.includes('download')) {
                progress = 50;
            } else if (logData.includes('연결') || logData.includes('connect')) {
                progress = 30;
            }
            
            await fs.writeFile(statusFile, JSON.stringify({
                status: 'running',
                progress,
                lastUpdate: new Date().toISOString()
            }));
        });

        childProcess.stderr.on('data', async (data) => {
            const errorData = data.toString();
            await fs.appendFile(logFile, `ERROR: ${errorData}`);
        });

        childProcess.on('close', async (code) => {
            const finalStatus = code === 0 ? 'completed' : 'failed';
            const finalProgress = code === 0 ? 100 : 0;
            
            await fs.writeFile(statusFile, JSON.stringify({
                status: finalStatus,
                progress: finalProgress,
                exitCode: code,
                endTime: new Date().toISOString()
            }));

            await fs.appendFile(logFile, `\nInstallation ${finalStatus} with exit code: ${code}\n`);

            // 서버 상태 업데이트
            const configs = await loadServerConfigs();
            const serverIndex = configs.servers.findIndex(s => s.id === server.id);
            if (serverIndex !== -1) {
                configs.servers[serverIndex].status = code === 0 ? 'online' : 'error';
                configs.servers[serverIndex].lastInstall = {
                    ...configs.servers[serverIndex].lastInstall,
                    endTime: new Date().toISOString(),
                    status: finalStatus,
                    exitCode: code
                };
                await saveServerConfigs(configs);
            }
        });

    } catch (error) {
        console.error('Installation failed:', error);
        
        // 에러 상태 저장
        await fs.writeFile(statusFile, JSON.stringify({
            status: 'failed',
            progress: 0,
            error: error.message,
            endTime: new Date().toISOString()
        }));
        
        await fs.appendFile(logFile, `\nInstallation failed: ${error.message}\n`);
    }
}

// 초기화
ensureDataDirectory();

module.exports = router;