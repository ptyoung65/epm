#!/usr/bin/env python3
"""
프로젝트 코드 분석 엔진
- 다양한 언어의 코드 분석 (Python, JavaScript, TypeScript, Java, Go 등)
- 프론트엔드/백엔드 구조 파악
- CRUD 매트릭스 자동 생성
- 의존성 관계 분석
"""

import os
import re
import json
import ast
import subprocess
import requests
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from urllib.parse import urlparse, urljoin
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class FileInfo:
    path: str
    name: str
    extension: str
    size: int
    lines: int
    language: str
    type: str  # 'frontend', 'backend', 'config', 'test', 'docs'

@dataclass 
class ComponentInfo:
    id: str
    name: str
    type: str  # 'controller', 'service', 'model', 'component', 'utility'
    language: str
    file_path: str
    lines_of_code: int
    complexity: str  # 'low', 'medium', 'high', 'very_high'
    dependencies: List[str]
    crud_operations: Dict[str, List[str]]  # datastore -> ['C', 'R', 'U', 'D']
    apis: List[str]
    description: str

@dataclass
class DataStoreInfo:
    id: str
    name: str
    type: str  # 'database', 'cache', 'file', 'api', 'queue'
    engine: str
    connection_pattern: str
    estimated_size: str
    operations: List[str]

@dataclass
class ProjectAnalysis:
    name: str
    url: Optional[str]
    root_path: str
    frontend_framework: str
    backend_framework: str
    components: List[ComponentInfo]
    datastores: List[DataStoreInfo] 
    crud_matrix: Dict[str, Dict[str, List[str]]]
    dependencies: Dict[str, int]
    metrics: Dict[str, Any]

class ProjectAnalyzer:
    def __init__(self):
        self.supported_extensions = {
            # Frontend
            '.js': 'javascript',
            '.jsx': 'javascript', 
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.vue': 'vue',
            '.html': 'html',
            '.css': 'css',
            '.scss': 'scss',
            '.sass': 'sass',
            
            # Backend
            '.py': 'python',
            '.java': 'java',
            '.go': 'go',
            '.rs': 'rust',
            '.cpp': 'cpp',
            '.c': 'c',
            '.cs': 'csharp',
            '.php': 'php',
            '.rb': 'ruby',
            
            # Config
            '.json': 'json',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.toml': 'toml',
            '.ini': 'ini',
            '.env': 'env',
            
            # Database
            '.sql': 'sql',
            '.mongodb': 'mongodb'
        }
        
        self.frontend_patterns = {
            'react': [r'import.*react', r'from [\'"]react[\'"]', r'React\.', r'useState', r'useEffect'],
            'vue': [r'<template>', r'Vue\.', r'@vue/', r'vue-', r'\.vue$'],
            'angular': [r'@angular/', r'@Component', r'@Injectable', r'@NgModule'],
            'svelte': [r'\.svelte$', r'svelte/', r'<script.*svelte'],
            'jquery': [r'\$\(', r'jQuery', r'jquery'],
            'vanilla': [r'document\.', r'window\.', r'addEventListener']
        }
        
        self.backend_patterns = {
            'express': [r'express\(\)', r'app\.get', r'app\.post', r'require.*express'],
            'fastapi': [r'from fastapi', r'FastAPI\(\)', r'@app\.get', r'@app\.post'],
            'django': [r'from django', r'django\.', r'models\.Model', r'HttpResponse'],
            'flask': [r'from flask', r'Flask\(__name__\)', r'@app\.route'],
            'spring': [r'@SpringBootApplication', r'@RestController', r'@Service', r'@Repository'],
            'gin': [r'gin\.', r'router\.GET', r'router\.POST', r'gin-gonic'],
            'node': [r'require\(', r'module\.exports', r'process\.env'],
            'koa': [r'require.*koa', r'new Koa\(\)', r'ctx\.body']
        }
        
        self.datastore_patterns = {
            'mongodb': [r'mongodb://', r'mongoose\.', r'MongoClient', r'db\.collection'],
            'mysql': [r'mysql://', r'mysql\.', r'CREATE TABLE', r'SELECT.*FROM'],
            'postgresql': [r'postgresql://', r'postgres://', r'pg\.', r'psycopg2'],
            'redis': [r'redis://', r'redis\.', r'RedisClient', r'HGET', r'SET '],
            'elasticsearch': [r'elasticsearch', r'ES_HOST', r'/_search', r'@elastic'],
            'firebase': [r'firebase', r'firestore', r'firebase-admin'],
            'sqlite': [r'sqlite3', r'\.db$', r'\.sqlite$', r'CREATE TABLE'],
            'clickhouse': [r'clickhouse', r'ClickHouse', r'CH_HOST'],
            'kafka': [r'kafka', r'KafkaProducer', r'KafkaConsumer', r'KAFKA_'],
            'rabbitmq': [r'rabbitmq', r'amqp://', r'pika\.']
        }
        
        self.crud_keywords = {
            'create': [r'\.save\(', r'\.create\(', r'\.insert\(', r'\.add\(', r'POST ', r'INSERT INTO'],
            'read': [r'\.find\(', r'\.get\(', r'\.select\(', r'\.query\(', r'GET ', r'SELECT.*FROM'],
            'update': [r'\.update\(', r'\.modify\(', r'\.edit\(', r'PUT ', r'PATCH ', r'UPDATE.*SET'],
            'delete': [r'\.delete\(', r'\.remove\(', r'\.destroy\(', r'DELETE ', r'DELETE FROM']
        }

    def analyze_from_url(self, url: str) -> Optional[ProjectAnalysis]:
        """URL에서 프로젝트를 클론/다운로드하여 분석"""
        try:
            logger.info(f"URL 분석 시작: {url}")
            
            # GitHub URL 처리
            if 'github.com' in url:
                return self._analyze_github_project(url)
            
            # GitLab URL 처리  
            elif 'gitlab.com' in url:
                return self._analyze_gitlab_project(url)
            
            # 일반 Git URL 처리
            elif url.endswith('.git'):
                return self._analyze_git_project(url)
            
            # ZIP 파일 URL 처리
            elif url.endswith('.zip'):
                return self._analyze_zip_project(url)
                
            else:
                logger.warning(f"지원하지 않는 URL 형식: {url}")
                return None
                
        except Exception as e:
            logger.error(f"URL 분석 실패: {e}")
            return None

    def analyze_directory(self, directory_path: str, project_name: str = None) -> ProjectAnalysis:
        """로컬 디렉토리 분석"""
        try:
            path = Path(directory_path)
            if not path.exists():
                raise FileNotFoundError(f"디렉토리를 찾을 수 없음: {directory_path}")
            
            logger.info(f"디렉토리 분석 시작: {directory_path}")
            
            project_name = project_name or path.name
            
            # 파일 스캔
            files = self._scan_files(path)
            logger.info(f"스캔된 파일: {len(files)}개")
            
            # 프레임워크 감지
            frontend_framework = self._detect_frontend_framework(files)
            backend_framework = self._detect_backend_framework(files)
            
            logger.info(f"감지된 프레임워크 - Frontend: {frontend_framework}, Backend: {backend_framework}")
            
            # 컴포넌트 분석
            components = self._analyze_components(files)
            logger.info(f"분석된 컴포넌트: {len(components)}개")
            
            # 데이터스토어 분석
            datastores = self._analyze_datastores(files)
            logger.info(f"감지된 데이터스토어: {len(datastores)}개")
            
            # CRUD 매트릭스 생성
            crud_matrix = self._generate_crud_matrix(components, datastores, files)
            
            # 의존성 분석
            dependencies = self._analyze_dependencies(files)
            
            # 메트릭스 계산
            metrics = self._calculate_metrics(files, components)
            
            analysis = ProjectAnalysis(
                name=project_name,
                url=None,
                root_path=str(path),
                frontend_framework=frontend_framework,
                backend_framework=backend_framework,
                components=components,
                datastores=datastores,
                crud_matrix=crud_matrix,
                dependencies=dependencies,
                metrics=metrics
            )
            
            logger.info(f"프로젝트 분석 완료: {project_name}")
            return analysis
            
        except Exception as e:
            logger.error(f"디렉토리 분석 실패: {e}")
            raise

    def _analyze_github_project(self, url: str) -> Optional[ProjectAnalysis]:
        """GitHub 프로젝트 분석"""
        try:
            # GitHub API로 정보 수집
            parsed = urlparse(url)
            repo_path = parsed.path.strip('/')
            
            if repo_path.endswith('.git'):
                repo_path = repo_path[:-4]
            
            api_url = f"https://api.github.com/repos/{repo_path}"
            response = requests.get(api_url)
            
            if response.status_code != 200:
                logger.warning(f"GitHub API 호출 실패: {response.status_code}")
                return None
            
            repo_info = response.json()
            
            # 임시 디렉토리에 클론
            temp_dir = f"/tmp/analysis_{repo_path.replace('/', '_')}"
            
            # 기존 디렉토리 삭제
            if os.path.exists(temp_dir):
                subprocess.run(['rm', '-rf', temp_dir], check=True)
            
            # Git clone
            clone_cmd = ['git', 'clone', '--depth', '1', url, temp_dir]
            result = subprocess.run(clone_cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                logger.error(f"Git clone 실패: {result.stderr}")
                return None
            
            # 프로젝트 분석
            analysis = self.analyze_directory(temp_dir, repo_info.get('name', 'Unknown'))
            analysis.url = url
            
            # 임시 디렉토리 정리
            subprocess.run(['rm', '-rf', temp_dir])
            
            return analysis
            
        except Exception as e:
            logger.error(f"GitHub 프로젝트 분석 실패: {e}")
            return None

    def _scan_files(self, root_path: Path) -> List[FileInfo]:
        """디렉토리에서 분석할 파일들 스캔"""
        files = []
        
        # 제외할 디렉토리
        exclude_dirs = {
            'node_modules', '.git', '__pycache__', '.pytest_cache',
            'venv', 'env', '.env', 'dist', 'build', '.next',
            'coverage', '.nyc_output', 'vendor', 'target'
        }
        
        for file_path in root_path.rglob('*'):
            if file_path.is_file():
                # 제외 디렉토리 체크
                if any(excluded in file_path.parts for excluded in exclude_dirs):
                    continue
                
                extension = file_path.suffix.lower()
                
                if extension in self.supported_extensions:
                    try:
                        stat = file_path.stat()
                        
                        # 파일 라인 수 계산
                        try:
                            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                                lines = sum(1 for _ in f)
                        except:
                            lines = 0
                        
                        # 파일 타입 결정
                        file_type = self._determine_file_type(file_path, extension)
                        
                        file_info = FileInfo(
                            path=str(file_path),
                            name=file_path.name,
                            extension=extension,
                            size=stat.st_size,
                            lines=lines,
                            language=self.supported_extensions[extension],
                            type=file_type
                        )
                        
                        files.append(file_info)
                        
                    except Exception as e:
                        logger.warning(f"파일 분석 실패 {file_path}: {e}")
                        continue
        
        return files

    def _determine_file_type(self, file_path: Path, extension: str) -> str:
        """파일 타입 결정 (frontend/backend/config/test/docs)"""
        path_str = str(file_path).lower()
        
        # 테스트 파일
        if any(pattern in path_str for pattern in ['test', 'spec', '__test__', '.test.', '.spec.']):
            return 'test'
        
        # 문서 파일
        if any(pattern in path_str for pattern in ['doc', 'readme', 'docs/', 'documentation']):
            return 'docs'
        
        # 설정 파일
        if extension in ['.json', '.yaml', '.yml', '.toml', '.ini', '.env']:
            return 'config'
        
        # 프론트엔드 파일
        if extension in ['.html', '.css', '.scss', '.sass'] or \
           any(pattern in path_str for pattern in ['public/', 'static/', 'assets/', 'client/', 'frontend/', 'src/components']):
            return 'frontend'
        
        # 백엔드 파일 (기본값)
        return 'backend'

    def _detect_frontend_framework(self, files: List[FileInfo]) -> str:
        """프론트엔드 프레임워크 감지"""
        framework_scores = {name: 0 for name in self.frontend_patterns.keys()}
        
        for file_info in files:
            if file_info.type in ['frontend', 'backend']:
                try:
                    with open(file_info.path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                    
                    for framework, patterns in self.frontend_patterns.items():
                        for pattern in patterns:
                            matches = len(re.findall(pattern, content, re.IGNORECASE))
                            framework_scores[framework] += matches
                            
                except Exception:
                    continue
        
        # 가장 높은 점수의 프레임워크 반환
        best_framework = max(framework_scores.items(), key=lambda x: x[1])
        return best_framework[0] if best_framework[1] > 0 else 'unknown'

    def _detect_backend_framework(self, files: List[FileInfo]) -> str:
        """백엔드 프레임워크 감지"""
        framework_scores = {name: 0 for name in self.backend_patterns.keys()}
        
        for file_info in files:
            if file_info.type == 'backend':
                try:
                    with open(file_info.path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                    
                    for framework, patterns in self.backend_patterns.items():
                        for pattern in patterns:
                            matches = len(re.findall(pattern, content, re.IGNORECASE))
                            framework_scores[framework] += matches
                            
                except Exception:
                    continue
        
        best_framework = max(framework_scores.items(), key=lambda x: x[1])
        return best_framework[0] if best_framework[1] > 0 else 'unknown'

    def _analyze_components(self, files: List[FileInfo]) -> List[ComponentInfo]:
        """코드 컴포넌트 분석"""
        components = []
        
        for file_info in files:
            if file_info.type in ['frontend', 'backend'] and file_info.lines > 10:
                try:
                    component = self._analyze_single_component(file_info)
                    if component:
                        components.append(component)
                except Exception as e:
                    logger.warning(f"컴포넌트 분석 실패 {file_info.path}: {e}")
                    continue
        
        return components

    def _analyze_single_component(self, file_info: FileInfo) -> Optional[ComponentInfo]:
        """단일 파일 컴포넌트 분석"""
        try:
            with open(file_info.path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            # 컴포넌트 타입 결정
            component_type = self._determine_component_type(file_info, content)
            
            # 복잡도 계산
            complexity = self._calculate_complexity(content, file_info.lines)
            
            # 의존성 추출
            dependencies = self._extract_dependencies(content, file_info.language)
            
            # CRUD 작업 감지
            crud_operations = self._detect_crud_operations(content)
            
            # API 엔드포인트 추출
            apis = self._extract_apis(content, file_info.language)
            
            # 설명 생성
            description = self._generate_component_description(file_info, component_type, content)
            
            component_id = f"{file_info.language}_{component_type}_{Path(file_info.path).stem}"
            
            return ComponentInfo(
                id=component_id,
                name=Path(file_info.path).stem,
                type=component_type,
                language=file_info.language,
                file_path=file_info.path,
                lines_of_code=file_info.lines,
                complexity=complexity,
                dependencies=dependencies,
                crud_operations=crud_operations,
                apis=apis,
                description=description
            )
            
        except Exception as e:
            logger.warning(f"컴포넌트 분석 실패: {e}")
            return None

    def _determine_component_type(self, file_info: FileInfo, content: str) -> str:
        """컴포넌트 타입 결정"""
        filename = file_info.name.lower()
        content_lower = content.lower()
        
        # 컨트롤러 패턴
        if any(pattern in filename for pattern in ['controller', 'handler', 'route', 'api']):
            return 'controller'
        
        if any(pattern in content_lower for pattern in ['@controller', '@restcontroller', 'router.', 'app.get', 'app.post']):
            return 'controller'
        
        # 서비스 패턴
        if any(pattern in filename for pattern in ['service', 'business', 'logic']):
            return 'service'
        
        if any(pattern in content_lower for pattern in ['@service', '@injectable', 'service']):
            return 'service'
        
        # 모델 패턴
        if any(pattern in filename for pattern in ['model', 'entity', 'schema', 'dto']):
            return 'model'
        
        if any(pattern in content_lower for pattern in ['@entity', '@model', 'mongoose.schema', 'class.*model']):
            return 'model'
        
        # 프론트엔드 컴포넌트
        if file_info.type == 'frontend':
            return 'component'
        
        # 유틸리티
        if any(pattern in filename for pattern in ['util', 'helper', 'common', 'tool']):
            return 'utility'
        
        return 'unknown'

    def _calculate_complexity(self, content: str, lines: int) -> str:
        """코드 복잡도 계산"""
        try:
            # 복잡도 지표들
            cyclomatic_complexity = 0
            
            # 조건문 개수
            conditions = len(re.findall(r'\b(if|else|elif|switch|case|while|for|catch)\b', content))
            
            # 함수 개수
            functions = len(re.findall(r'\b(function|def|func|method|class)\b', content))
            
            # 중첩 깊이 (대략적 계산)
            nesting_depth = max(content.count('{') - content.count('}'), 
                               content.count('(') - content.count(')')) if content else 0
            
            # 복잡도 점수 계산
            complexity_score = (conditions * 2 + functions + nesting_depth + lines / 100) / 10
            
            if complexity_score < 2:
                return 'low'
            elif complexity_score < 5:
                return 'medium'
            elif complexity_score < 10:
                return 'high'
            else:
                return 'very_high'
                
        except Exception:
            # 라인 수 기반 기본 계산
            if lines < 50:
                return 'low'
            elif lines < 200:
                return 'medium'
            elif lines < 500:
                return 'high'
            else:
                return 'very_high'

    def _extract_dependencies(self, content: str, language: str) -> List[str]:
        """의존성 추출"""
        dependencies = []
        
        try:
            if language == 'javascript' or language == 'typescript':
                # import/require 패턴
                imports = re.findall(r'import.*from\s+[\'"]([^\'"]+)[\'"]', content)
                requires = re.findall(r'require\([\'"]([^\'"]+)[\'"]\)', content)
                dependencies.extend(imports + requires)
                
            elif language == 'python':
                # import 패턴
                imports = re.findall(r'from\s+(\w+)', content)
                imports += re.findall(r'import\s+(\w+)', content)
                dependencies.extend(imports)
                
            elif language == 'java':
                # import 패턴
                imports = re.findall(r'import\s+([\w.]+)', content)
                dependencies.extend(imports)
                
            # 중복 제거 및 내장 모듈 필터링
            dependencies = list(set(dep for dep in dependencies if not dep.startswith('.')))
            
        except Exception:
            pass
        
        return dependencies[:10]  # 최대 10개로 제한

    def _detect_crud_operations(self, content: str) -> Dict[str, List[str]]:
        """CRUD 작업 감지"""
        crud_ops = {}
        
        for operation, patterns in self.crud_keywords.items():
            for pattern in patterns:
                if re.search(pattern, content, re.IGNORECASE):
                    # 데이터스토어 추정 (단순화)
                    if 'mongodb' in content.lower() or 'mongoose' in content.lower():
                        datastore = 'mongodb'
                    elif 'mysql' in content.lower() or 'sql' in content.lower():
                        datastore = 'mysql'
                    elif 'redis' in content.lower():
                        datastore = 'redis'
                    else:
                        datastore = 'database'
                    
                    if datastore not in crud_ops:
                        crud_ops[datastore] = []
                    
                    if operation[0].upper() not in crud_ops[datastore]:
                        crud_ops[datastore].append(operation[0].upper())
                    
                    break
        
        return crud_ops

    def _extract_apis(self, content: str, language: str) -> List[str]:
        """API 엔드포인트 추출"""
        apis = []
        
        try:
            # REST API 패턴
            rest_patterns = [
                r'@app\.route\([\'"]([^\'"]+)[\'"]',  # Flask
                r'app\.(get|post|put|delete)\([\'"]([^\'"]+)[\'"]',  # Express
                r'router\.(GET|POST|PUT|DELETE)\([\'"]([^\'"]+)[\'"]',  # Various
                r'@RequestMapping\([\'"]([^\'"]+)[\'"]',  # Spring
                r'@GetMapping\([\'"]([^\'"]+)[\'"]',  # Spring
                r'@PostMapping\([\'"]([^\'"]+)[\'"]'  # Spring
            ]
            
            for pattern in rest_patterns:
                matches = re.findall(pattern, content, re.IGNORECASE)
                for match in matches:
                    if isinstance(match, tuple):
                        apis.append(match[-1])  # 마지막 그룹 (경로)
                    else:
                        apis.append(match)
            
        except Exception:
            pass
        
        return list(set(apis))[:20]  # 중복 제거 및 최대 20개

    def _generate_component_description(self, file_info: FileInfo, component_type: str, content: str) -> str:
        """컴포넌트 설명 생성"""
        try:
            # 파일 이름 기반 설명
            name = Path(file_info.path).stem
            
            # 코멘트에서 설명 추출 시도
            doc_patterns = [
                r'/\*\*(.*?)\*/',  # JSDoc
                r'"""(.*?)"""',    # Python docstring
                r'#\s*(.*)',       # 단일 라인 코멘트
            ]
            
            for pattern in doc_patterns:
                matches = re.findall(pattern, content[:500], re.DOTALL)  # 첫 500자만 검사
                if matches:
                    desc = matches[0].strip()
                    if len(desc) > 10:
                        return desc[:100] + '...' if len(desc) > 100 else desc
            
            # 기본 설명 생성
            type_desc = {
                'controller': 'API 엔드포인트 처리',
                'service': '비즈니스 로직 구현',
                'model': '데이터 모델 정의',
                'component': 'UI 컴포넌트',
                'utility': '공통 유틸리티 함수'
            }
            
            return f"{type_desc.get(component_type, '코드 모듈')} - {name}"
            
        except Exception:
            return f"{component_type} 모듈"

    def _analyze_datastores(self, files: List[FileInfo]) -> List[DataStoreInfo]:
        """데이터스토어 분석"""
        datastores = {}
        
        for file_info in files:
            try:
                with open(file_info.path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                for datastore_type, patterns in self.datastore_patterns.items():
                    for pattern in patterns:
                        if re.search(pattern, content, re.IGNORECASE):
                            if datastore_type not in datastores:
                                datastores[datastore_type] = {
                                    'files': [],
                                    'connections': 0,
                                    'operations': set()
                                }
                            
                            datastores[datastore_type]['files'].append(file_info.path)
                            datastores[datastore_type]['connections'] += 1
                            
                            # 작업 유형 감지
                            for operation, op_patterns in self.crud_keywords.items():
                                for op_pattern in op_patterns:
                                    if re.search(op_pattern, content, re.IGNORECASE):
                                        datastores[datastore_type]['operations'].add(operation)
                            
                            break
                            
            except Exception:
                continue
        
        # DataStoreInfo 객체 생성
        result = []
        for ds_type, info in datastores.items():
            datastore_info = DataStoreInfo(
                id=ds_type,
                name=self._get_datastore_display_name(ds_type),
                type=self._get_datastore_type(ds_type),
                engine=ds_type.title(),
                connection_pattern=f"감지된 연결: {info['connections']}개",
                estimated_size="분석 불가",
                operations=list(info['operations'])
            )
            result.append(datastore_info)
        
        return result

    def _get_datastore_display_name(self, ds_type: str) -> str:
        """데이터스토어 표시 이름"""
        names = {
            'mongodb': 'MongoDB Database',
            'mysql': 'MySQL Database',
            'postgresql': 'PostgreSQL Database',
            'redis': 'Redis Cache',
            'elasticsearch': 'Elasticsearch Index',
            'firebase': 'Firebase Store',
            'sqlite': 'SQLite Database',
            'clickhouse': 'ClickHouse Analytics',
            'kafka': 'Kafka Streams',
            'rabbitmq': 'RabbitMQ Queue'
        }
        return names.get(ds_type, ds_type.title())

    def _get_datastore_type(self, ds_type: str) -> str:
        """데이터스토어 타입 분류"""
        types = {
            'mongodb': 'NoSQL Database',
            'mysql': 'Relational Database',
            'postgresql': 'Relational Database',
            'redis': 'Cache',
            'elasticsearch': 'Search Engine',
            'firebase': 'Cloud Database',
            'sqlite': 'Embedded Database',
            'clickhouse': 'Analytics Database',
            'kafka': 'Message Queue',
            'rabbitmq': 'Message Queue'
        }
        return types.get(ds_type, 'Database')

    def _generate_crud_matrix(self, components: List[ComponentInfo], 
                            datastores: List[DataStoreInfo], 
                            files: List[FileInfo]) -> Dict[str, Dict[str, List[str]]]:
        """CRUD 매트릭스 생성"""
        matrix = {}
        
        for component in components:
            matrix[component.id] = {}
            
            for datastore in datastores:
                operations = []
                
                # 컴포넌트의 CRUD 작업에서 해당 데이터스토어 확인
                if datastore.id in component.crud_operations:
                    operations = component.crud_operations[datastore.id]
                
                # 파일 내용 재분석으로 더 정확한 CRUD 감지
                try:
                    with open(component.file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read().lower()
                    
                    # 데이터스토어별 특화 패턴 확인
                    if any(pattern.lower() in content for pattern in self.datastore_patterns.get(datastore.id, [])):
                        for operation, patterns in self.crud_keywords.items():
                            for pattern in patterns:
                                if re.search(pattern, content, re.IGNORECASE):
                                    op_letter = operation[0].upper()
                                    if op_letter not in operations:
                                        operations.append(op_letter)
                                    break
                
                except Exception:
                    pass
                
                if operations:
                    matrix[component.id][datastore.id] = operations
        
        return matrix

    def _analyze_dependencies(self, files: List[FileInfo]) -> Dict[str, int]:
        """프로젝트 의존성 분석"""
        dependencies = {}
        
        # package.json 분석
        for file_info in files:
            if file_info.name == 'package.json':
                try:
                    with open(file_info.path, 'r', encoding='utf-8') as f:
                        package_data = json.load(f)
                    
                    deps = package_data.get('dependencies', {})
                    dev_deps = package_data.get('devDependencies', {})
                    
                    all_deps = {**deps, **dev_deps}
                    dependencies.update({name: 1 for name in all_deps.keys()})
                    
                except Exception:
                    continue
        
        # requirements.txt 분석
        for file_info in files:
            if file_info.name == 'requirements.txt':
                try:
                    with open(file_info.path, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                    
                    for line in lines:
                        if line.strip() and not line.startswith('#'):
                            pkg_name = line.split('==')[0].split('>=')[0].split('<=')[0].strip()
                            dependencies[pkg_name] = 1
                            
                except Exception:
                    continue
        
        return dependencies

    def _calculate_metrics(self, files: List[FileInfo], components: List[ComponentInfo]) -> Dict[str, Any]:
        """프로젝트 메트릭스 계산"""
        total_lines = sum(f.lines for f in files)
        total_files = len(files)
        
        # 언어별 통계
        language_stats = {}
        for file_info in files:
            lang = file_info.language
            if lang not in language_stats:
                language_stats[lang] = {'files': 0, 'lines': 0}
            language_stats[lang]['files'] += 1
            language_stats[lang]['lines'] += file_info.lines
        
        # 복잡도 분포
        complexity_dist = {'low': 0, 'medium': 0, 'high': 0, 'very_high': 0}
        for component in components:
            complexity_dist[component.complexity] += 1
        
        # 타입별 통계
        type_stats = {}
        for file_info in files:
            file_type = file_info.type
            if file_type not in type_stats:
                type_stats[file_type] = {'files': 0, 'lines': 0}
            type_stats[file_type]['files'] += 1
            type_stats[file_type]['lines'] += file_info.lines
        
        return {
            'total_files': total_files,
            'total_lines': total_lines,
            'avg_lines_per_file': total_lines / total_files if total_files > 0 else 0,
            'language_distribution': language_stats,
            'complexity_distribution': complexity_dist,
            'type_distribution': type_stats,
            'component_count': len(components),
            'estimated_effort_hours': total_lines / 50  # 대략적 개발 시간 추정
        }

def main():
    """CLI 테스트"""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python project_analyzer.py <directory_or_url>")
        sys.exit(1)
    
    target = sys.argv[1]
    analyzer = ProjectAnalyzer()
    
    if target.startswith('http'):
        analysis = analyzer.analyze_from_url(target)
    else:
        analysis = analyzer.analyze_directory(target)
    
    if analysis:
        print(json.dumps(asdict(analysis), indent=2, ensure_ascii=False))
    else:
        print("분석 실패")
        sys.exit(1)

if __name__ == "__main__":
    main()