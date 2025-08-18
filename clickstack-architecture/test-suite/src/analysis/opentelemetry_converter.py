#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AIRIS-MON OpenTelemetry SDK 자동 적용 시스템
=====================================

.git 디렉토리를 기반으로 Java, Python 프로그램에 
OpenTelemetry SDK를 자동으로 적용하는 배치 프로그램

Authors: AIRIS-MON Development Team
Created: 2025-08-15
Version: 1.0.0
"""

import os
import re
import json
import shutil
import subprocess
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Set
from dataclasses import dataclass, asdict
import tempfile

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('opentelemetry_converter.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class ConversionResult:
    """변환 결과를 저장하는 데이터 클래스"""
    file_path: str
    language: str
    original_size: int
    converted_size: int
    added_imports: List[str]
    added_instrumentations: List[str]
    status: str  # 'success', 'failed', 'skipped'
    error_message: Optional[str] = None
    backup_path: Optional[str] = None

@dataclass
class ProjectAnalysis:
    """프로젝트 분석 결과를 저장하는 데이터 클래스"""
    project_path: str
    total_files: int
    java_files: int
    python_files: int
    has_maven: bool
    has_gradle: bool
    has_requirements_txt: bool
    has_poetry: bool
    framework_type: str  # 'spring', 'django', 'flask', 'fastapi', 'unknown'
    existing_otel: bool  # 이미 OpenTelemetry가 적용되어 있는지

class OpenTelemetryConverter:
    """OpenTelemetry SDK 자동 적용 클래스"""
    
    def __init__(self, git_directory: str):
        """
        초기화
        
        Args:
            git_directory (str): .git 디렉토리가 있는 프로젝트 루트 경로
        """
        self.git_directory = Path(git_directory)
        self.project_root = self.git_directory.parent if self.git_directory.name == '.git' else self.git_directory
        self.backup_dir = self.project_root / '.otel_backup'
        self.conversion_results: List[ConversionResult] = []
        self.exclude_patterns = []
        
        # 지원하는 파일 확장자
        self.java_extensions = {'.java'}
        self.python_extensions = {'.py'}
        
        # OpenTelemetry Java 의존성
        self.java_otel_dependencies = [
            'io.opentelemetry:opentelemetry-api',
            'io.opentelemetry:opentelemetry-sdk',
            'io.opentelemetry:opentelemetry-exporter-jaeger',
            'io.opentelemetry:opentelemetry-instrumentation-auto',
            'io.opentelemetry.instrumentation:opentelemetry-spring-boot-starter'
        ]
        
        # OpenTelemetry Python 의존성
        self.python_otel_dependencies = [
            'opentelemetry-api',
            'opentelemetry-sdk',
            'opentelemetry-exporter-jaeger-thrift',
            'opentelemetry-instrumentation-auto-instrumentation',
            'opentelemetry-instrumentation-flask',
            'opentelemetry-instrumentation-django',
            'opentelemetry-instrumentation-fastapi',
            'opentelemetry-instrumentation-requests'
        ]
        
        logger.info(f"OpenTelemetry 컨버터 초기화: {self.project_root}")

    def analyze_project(self) -> ProjectAnalysis:
        """
        프로젝트 분석
        
        Returns:
            ProjectAnalysis: 프로젝트 분석 결과
        """
        logger.info("프로젝트 분석 시작...")
        
        # 파일 통계
        java_files = list(self.project_root.rglob('*.java'))
        python_files = list(self.project_root.rglob('*.py'))
        
        # 빌드 도구 확인
        has_maven = (self.project_root / 'pom.xml').exists()
        has_gradle = (self.project_root / 'build.gradle').exists() or (self.project_root / 'build.gradle.kts').exists()
        has_requirements = (self.project_root / 'requirements.txt').exists()
        has_poetry = (self.project_root / 'pyproject.toml').exists()
        
        # 프레임워크 타입 감지
        framework_type = self._detect_framework_type()
        
        # 기존 OpenTelemetry 확인
        existing_otel = self._check_existing_opentelemetry()
        
        analysis = ProjectAnalysis(
            project_path=str(self.project_root),
            total_files=len(java_files) + len(python_files),
            java_files=len(java_files),
            python_files=len(python_files),
            has_maven=has_maven,
            has_gradle=has_gradle,
            has_requirements_txt=has_requirements,
            has_poetry=has_poetry,
            framework_type=framework_type,
            existing_otel=existing_otel
        )
        
        logger.info(f"프로젝트 분석 완료: Java {analysis.java_files}개, Python {analysis.python_files}개 파일")
        return analysis

    def _detect_framework_type(self) -> str:
        """프레임워크 타입 감지"""
        # Spring Boot 감지
        if (self.project_root / 'pom.xml').exists():
            pom_content = (self.project_root / 'pom.xml').read_text(encoding='utf-8', errors='ignore')
            if 'spring-boot' in pom_content.lower():
                return 'spring'
        
        # Python 프레임워크 감지
        python_files = list(self.project_root.rglob('*.py'))
        for py_file in python_files[:10]:  # 처음 10개 파일만 확인
            try:
                content = py_file.read_text(encoding='utf-8', errors='ignore')
                if 'from django' in content or 'import django' in content:
                    return 'django'
                elif 'from flask' in content or 'import flask' in content:
                    return 'flask'
                elif 'from fastapi' in content or 'import fastapi' in content:
                    return 'fastapi'
            except Exception:
                continue
        
        return 'unknown'

    def _check_existing_opentelemetry(self) -> bool:
        """기존 OpenTelemetry 의존성 확인"""
        # Maven 확인
        pom_path = self.project_root / 'pom.xml'
        if pom_path.exists():
            pom_content = pom_path.read_text(encoding='utf-8', errors='ignore')
            if 'opentelemetry' in pom_content.lower():
                return True
        
        # Gradle 확인
        for gradle_file in ['build.gradle', 'build.gradle.kts']:
            gradle_path = self.project_root / gradle_file
            if gradle_path.exists():
                gradle_content = gradle_path.read_text(encoding='utf-8', errors='ignore')
                if 'opentelemetry' in gradle_content.lower():
                    return True
        
        # Python requirements 확인
        req_path = self.project_root / 'requirements.txt'
        if req_path.exists():
            req_content = req_path.read_text(encoding='utf-8', errors='ignore')
            if 'opentelemetry' in req_content.lower():
                return True
        
        return False

    def create_backup(self) -> bool:
        """
        백업 디렉토리 생성
        
        Returns:
            bool: 성공 여부
        """
        try:
            if self.backup_dir.exists():
                shutil.rmtree(self.backup_dir)
            self.backup_dir.mkdir(parents=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_info = {
                'timestamp': timestamp,
                'project_path': str(self.project_root),
                'backup_reason': 'OpenTelemetry 자동 적용 전 백업'
            }
            
            with open(self.backup_dir / 'backup_info.json', 'w', encoding='utf-8') as f:
                json.dump(backup_info, f, indent=2, ensure_ascii=False)
            
            logger.info(f"백업 디렉토리 생성: {self.backup_dir}")
            return True
            
        except Exception as e:
            logger.error(f"백업 디렉토리 생성 실패: {e}")
            return False

    def backup_file(self, file_path: Path) -> Optional[str]:
        """
        개별 파일 백업
        
        Args:
            file_path (Path): 백업할 파일 경로
            
        Returns:
            Optional[str]: 백업된 파일 경로
        """
        try:
            relative_path = file_path.relative_to(self.project_root)
            backup_file_path = self.backup_dir / relative_path
            backup_file_path.parent.mkdir(parents=True, exist_ok=True)
            
            shutil.copy2(file_path, backup_file_path)
            return str(backup_file_path)
            
        except Exception as e:
            logger.error(f"파일 백업 실패 {file_path}: {e}")
            return None

    def convert_java_file(self, file_path: Path) -> ConversionResult:
        """
        Java 파일에 OpenTelemetry 적용
        
        Args:
            file_path (Path): 변환할 Java 파일 경로
            
        Returns:
            ConversionResult: 변환 결과
        """
        logger.info(f"Java 파일 변환 시작: {file_path}")
        
        try:
            # 원본 파일 읽기
            original_content = file_path.read_text(encoding='utf-8', errors='ignore')
            original_size = len(original_content)
            
            # 이미 OpenTelemetry가 적용되어 있는지 확인
            if 'opentelemetry' in original_content.lower():
                return ConversionResult(
                    file_path=str(file_path),
                    language='java',
                    original_size=original_size,
                    converted_size=original_size,
                    added_imports=[],
                    added_instrumentations=[],
                    status='skipped',
                    error_message='이미 OpenTelemetry가 적용되어 있습니다'
                )
            
            # 백업
            backup_path = self.backup_file(file_path)
            
            # 변환 로직 적용
            converted_content = self._apply_java_otel_instrumentation(original_content, file_path)
            
            # 변환된 내용 저장
            file_path.write_text(converted_content, encoding='utf-8')
            
            return ConversionResult(
                file_path=str(file_path),
                language='java',
                original_size=original_size,
                converted_size=len(converted_content),
                added_imports=self._extract_added_imports(original_content, converted_content, 'java'),
                added_instrumentations=['@Trace', 'Span'],
                status='success',
                backup_path=backup_path
            )
            
        except Exception as e:
            logger.error(f"Java 파일 변환 실패 {file_path}: {e}")
            return ConversionResult(
                file_path=str(file_path),
                language='java',
                original_size=0,
                converted_size=0,
                added_imports=[],
                added_instrumentations=[],
                status='failed',
                error_message=str(e)
            )

    def _apply_java_otel_instrumentation(self, content: str, file_path: Path) -> str:
        """Java 파일에 OpenTelemetry 계측 코드 추가"""
        lines = content.split('\n')
        modified_lines = []
        
        # import 섹션 찾기
        import_section_end = -1
        package_line = -1
        
        for i, line in enumerate(lines):
            if line.strip().startswith('package '):
                package_line = i
            elif line.strip().startswith('import '):
                import_section_end = max(import_section_end, i)
        
        # OpenTelemetry import 추가
        otel_imports = [
            'import io.opentelemetry.api.OpenTelemetry;',
            'import io.opentelemetry.api.trace.Span;',
            'import io.opentelemetry.api.trace.Tracer;',
            'import io.opentelemetry.instrumentation.annotations.WithSpan;',
            'import io.opentelemetry.instrumentation.annotations.SpanAttribute;'
        ]
        
        for i, line in enumerate(lines):
            modified_lines.append(line)
            
            # import 섹션 끝에 OpenTelemetry import 추가
            if i == import_section_end:
                modified_lines.extend(otel_imports)
                modified_lines.append('')
            
            # 클래스 내부의 public 메서드에 @WithSpan 어노테이션 추가
            if self._is_method_declaration(line) and 'public' in line:
                # 메서드 위에 @WithSpan 추가
                indent = len(line) - len(line.lstrip())
                modified_lines.insert(-1, ' ' * indent + '@WithSpan')
        
        return '\n'.join(modified_lines)

    def _is_method_declaration(self, line: str) -> bool:
        """Java 메서드 선언인지 확인"""
        line = line.strip()
        return (
            'public' in line and 
            '(' in line and 
            ')' in line and 
            '{' in line and
            not line.startswith('//') and
            not line.startswith('*')
        )

    def convert_python_file(self, file_path: Path) -> ConversionResult:
        """
        Python 파일에 OpenTelemetry 적용
        
        Args:
            file_path (Path): 변환할 Python 파일 경로
            
        Returns:
            ConversionResult: 변환 결과
        """
        logger.info(f"Python 파일 변환 시작: {file_path}")
        
        try:
            # 원본 파일 읽기
            original_content = file_path.read_text(encoding='utf-8', errors='ignore')
            original_size = len(original_content)
            
            # 이미 OpenTelemetry가 적용되어 있는지 확인
            if 'opentelemetry' in original_content.lower():
                return ConversionResult(
                    file_path=str(file_path),
                    language='python',
                    original_size=original_size,
                    converted_size=original_size,
                    added_imports=[],
                    added_instrumentations=[],
                    status='skipped',
                    error_message='이미 OpenTelemetry가 적용되어 있습니다'
                )
            
            # 백업
            backup_path = self.backup_file(file_path)
            
            # 변환 로직 적용
            converted_content = self._apply_python_otel_instrumentation(original_content, file_path)
            
            # 변환된 내용 저장
            file_path.write_text(converted_content, encoding='utf-8')
            
            return ConversionResult(
                file_path=str(file_path),
                language='python',
                original_size=original_size,
                converted_size=len(converted_content),
                added_imports=self._extract_added_imports(original_content, converted_content, 'python'),
                added_instrumentations=['tracer.start_as_current_span', '@trace'],
                status='success',
                backup_path=backup_path
            )
            
        except Exception as e:
            logger.error(f"Python 파일 변환 실패 {file_path}: {e}")
            return ConversionResult(
                file_path=str(file_path),
                language='python',
                original_size=0,
                converted_size=0,
                added_imports=[],
                added_instrumentations=[],
                status='failed',
                error_message=str(e)
            )

    def _apply_python_otel_instrumentation(self, content: str, file_path: Path) -> str:
        """Python 파일에 OpenTelemetry 계측 코드 추가"""
        lines = content.split('\n')
        modified_lines = []
        
        # 첫 번째 import나 코드 라인 찾기
        first_import_line = -1
        for i, line in enumerate(lines):
            if line.strip() and not line.strip().startswith('#') and not line.strip().startswith('"""'):
                first_import_line = i
                break
        
        # OpenTelemetry import 추가
        otel_imports = [
            'from opentelemetry import trace',
            'from opentelemetry.exporter.jaeger.thrift import JaegerExporter',
            'from opentelemetry.sdk.trace import TracerProvider',
            'from opentelemetry.sdk.trace.export import BatchSpanProcessor',
            'from opentelemetry.instrumentation.auto_instrumentation import sitecustomize',
            '',
            '# OpenTelemetry 초기화',
            'trace.set_tracer_provider(TracerProvider())',
            'tracer = trace.get_tracer(__name__)',
            ''
        ]
        
        for i, line in enumerate(lines):
            # 첫 번째 코드 라인 앞에 OpenTelemetry import 추가
            if i == first_import_line:
                modified_lines.extend(otel_imports)
            
            modified_lines.append(line)
            
            # 함수 정의에 트레이싱 추가
            if line.strip().startswith('def ') and not line.strip().startswith('def __'):
                # 함수 내부 첫 라인에 span 시작 코드 추가
                indent = self._get_function_indent(lines, i)
                function_name = self._extract_function_name(line)
                span_code = f'{indent}    with tracer.start_as_current_span("{function_name}"):'
                
                # 다음 라인들을 더 들여쓰기
                j = i + 1
                while j < len(lines) and (not lines[j].strip() or lines[j].startswith(indent + '    ')):
                    if lines[j].strip():
                        lines[j] = '    ' + lines[j]
                    j += 1
        
        return '\n'.join(modified_lines)

    def _get_function_indent(self, lines: List[str], func_line_idx: int) -> str:
        """함수의 들여쓰기 레벨 반환"""
        line = lines[func_line_idx]
        return line[:len(line) - len(line.lstrip())]

    def _extract_function_name(self, line: str) -> str:
        """함수명 추출"""
        match = re.search(r'def\s+([a-zA-Z_][a-zA-Z0-9_]*)', line)
        return match.group(1) if match else 'unknown_function'

    def _extract_added_imports(self, original: str, converted: str, language: str) -> List[str]:
        """추가된 import 문 추출"""
        original_imports = set()
        converted_imports = set()
        
        import_pattern = r'^(?:import|from)\s+.*$' if language == 'python' else r'^import\s+.*$'
        
        for line in original.split('\n'):
            if re.match(import_pattern, line.strip()):
                original_imports.add(line.strip())
        
        for line in converted.split('\n'):
            if re.match(import_pattern, line.strip()):
                converted_imports.add(line.strip())
        
        return list(converted_imports - original_imports)

    def update_build_files(self, analysis: ProjectAnalysis) -> bool:
        """빌드 파일 업데이트 (pom.xml, build.gradle, requirements.txt 등)"""
        success = True
        
        try:
            # Maven pom.xml 업데이트
            if analysis.has_maven:
                success &= self._update_maven_dependencies()
            
            # Gradle build.gradle 업데이트
            if analysis.has_gradle:
                success &= self._update_gradle_dependencies()
            
            # Python requirements.txt 업데이트
            if analysis.has_requirements_txt:
                success &= self._update_python_requirements()
            
            # Poetry pyproject.toml 업데이트
            if analysis.has_poetry:
                success &= self._update_poetry_dependencies()
            
            return success
            
        except Exception as e:
            logger.error(f"빌드 파일 업데이트 실패: {e}")
            return False

    def _update_maven_dependencies(self) -> bool:
        """Maven pom.xml에 OpenTelemetry 의존성 추가"""
        pom_path = self.project_root / 'pom.xml'
        if not pom_path.exists():
            return False
        
        try:
            content = pom_path.read_text(encoding='utf-8')
            
            # 이미 OpenTelemetry 의존성이 있는지 확인
            if 'opentelemetry' in content.lower():
                logger.info("Maven pom.xml에 이미 OpenTelemetry 의존성이 존재합니다")
                return True
            
            # 백업
            self.backup_file(pom_path)
            
            # dependencies 섹션 찾기
            dependencies_pattern = r'(<dependencies>)'
            otel_dependencies_xml = """
        <!-- OpenTelemetry Dependencies -->
        <dependency>
            <groupId>io.opentelemetry</groupId>
            <artifactId>opentelemetry-api</artifactId>
            <version>1.32.0</version>
        </dependency>
        <dependency>
            <groupId>io.opentelemetry</groupId>
            <artifactId>opentelemetry-sdk</artifactId>
            <version>1.32.0</version>
        </dependency>
        <dependency>
            <groupId>io.opentelemetry</groupId>
            <artifactId>opentelemetry-exporter-jaeger</artifactId>
            <version>1.32.0</version>
        </dependency>
        <dependency>
            <groupId>io.opentelemetry.instrumentation</groupId>
            <artifactId>opentelemetry-spring-boot-starter</artifactId>
            <version>1.32.0-alpha</version>
        </dependency>"""
            
            updated_content = re.sub(
                dependencies_pattern,
                f'\\1{otel_dependencies_xml}',
                content
            )
            
            pom_path.write_text(updated_content, encoding='utf-8')
            logger.info("Maven pom.xml에 OpenTelemetry 의존성 추가 완료")
            return True
            
        except Exception as e:
            logger.error(f"Maven 의존성 업데이트 실패: {e}")
            return False

    def _update_gradle_dependencies(self) -> bool:
        """Gradle build.gradle에 OpenTelemetry 의존성 추가"""
        gradle_files = ['build.gradle', 'build.gradle.kts']
        
        for gradle_file in gradle_files:
            gradle_path = self.project_root / gradle_file
            if gradle_path.exists():
                try:
                    content = gradle_path.read_text(encoding='utf-8')
                    
                    if 'opentelemetry' in content.lower():
                        logger.info(f"{gradle_file}에 이미 OpenTelemetry 의존성이 존재합니다")
                        return True
                    
                    # 백업
                    self.backup_file(gradle_path)
                    
                    # dependencies 블록 찾기
                    otel_dependencies = """
    // OpenTelemetry Dependencies
    implementation 'io.opentelemetry:opentelemetry-api:1.32.0'
    implementation 'io.opentelemetry:opentelemetry-sdk:1.32.0'
    implementation 'io.opentelemetry:opentelemetry-exporter-jaeger:1.32.0'
    implementation 'io.opentelemetry.instrumentation:opentelemetry-spring-boot-starter:1.32.0-alpha'"""
                    
                    # dependencies 블록에 추가
                    dependencies_pattern = r'(dependencies\s*\{)'
                    updated_content = re.sub(
                        dependencies_pattern,
                        f'\\1{otel_dependencies}',
                        content
                    )
                    
                    gradle_path.write_text(updated_content, encoding='utf-8')
                    logger.info(f"{gradle_file}에 OpenTelemetry 의존성 추가 완료")
                    return True
                    
                except Exception as e:
                    logger.error(f"Gradle 의존성 업데이트 실패 {gradle_file}: {e}")
                    continue
        
        return False

    def _update_python_requirements(self) -> bool:
        """requirements.txt에 OpenTelemetry 패키지 추가"""
        req_path = self.project_root / 'requirements.txt'
        if not req_path.exists():
            return False
        
        try:
            content = req_path.read_text(encoding='utf-8')
            
            if 'opentelemetry' in content.lower():
                logger.info("requirements.txt에 이미 OpenTelemetry 패키지가 존재합니다")
                return True
            
            # 백업
            self.backup_file(req_path)
            
            # OpenTelemetry 패키지 추가
            otel_packages = [
                'opentelemetry-api==1.21.0',
                'opentelemetry-sdk==1.21.0',
                'opentelemetry-exporter-jaeger-thrift==1.21.0',
                'opentelemetry-instrumentation-auto-instrumentation==0.42b0',
                'opentelemetry-instrumentation-flask==0.42b0',
                'opentelemetry-instrumentation-django==0.42b0',
                'opentelemetry-instrumentation-fastapi==0.42b0',
                'opentelemetry-instrumentation-requests==0.42b0'
            ]
            
            updated_content = content.rstrip() + '\n\n# OpenTelemetry packages\n' + '\n'.join(otel_packages) + '\n'
            req_path.write_text(updated_content, encoding='utf-8')
            
            logger.info("requirements.txt에 OpenTelemetry 패키지 추가 완료")
            return True
            
        except Exception as e:
            logger.error(f"Python requirements 업데이트 실패: {e}")
            return False

    def _update_poetry_dependencies(self) -> bool:
        """pyproject.toml에 OpenTelemetry 의존성 추가"""
        poetry_path = self.project_root / 'pyproject.toml'
        if not poetry_path.exists():
            return False
        
        try:
            content = poetry_path.read_text(encoding='utf-8')
            
            if 'opentelemetry' in content.lower():
                logger.info("pyproject.toml에 이미 OpenTelemetry 의존성이 존재합니다")
                return True
            
            # 백업
            self.backup_file(poetry_path)
            
            # [tool.poetry.dependencies] 섹션에 추가
            otel_deps = '''
# OpenTelemetry dependencies
opentelemetry-api = "^1.21.0"
opentelemetry-sdk = "^1.21.0"
opentelemetry-exporter-jaeger-thrift = "^1.21.0"
opentelemetry-instrumentation-auto-instrumentation = "^0.42b0"'''
            
            # dependencies 섹션 찾아서 추가
            dependencies_pattern = r'(\[tool\.poetry\.dependencies\])'
            updated_content = re.sub(
                dependencies_pattern,
                f'\\1{otel_deps}',
                content
            )
            
            poetry_path.write_text(updated_content, encoding='utf-8')
            logger.info("pyproject.toml에 OpenTelemetry 의존성 추가 완료")
            return True
            
        except Exception as e:
            logger.error(f"Poetry 의존성 업데이트 실패: {e}")
            return False

    def convert_project(self) -> Dict:
        """
        프로젝트 전체 변환 실행
        
        Returns:
            Dict: 변환 결과 요약
        """
        logger.info("=== OpenTelemetry 자동 변환 시작 ===")
        
        # 1. 프로젝트 분석
        analysis = self.analyze_project()
        
        if analysis.existing_otel:
            logger.warning("이미 OpenTelemetry가 적용된 프로젝트입니다")
            return {
                'status': 'skipped',
                'message': '이미 OpenTelemetry가 적용된 프로젝트',
                'analysis': asdict(analysis),
                'conversion_results': []
            }
        
        # 2. 백업 생성
        if not self.create_backup():
            return {
                'status': 'failed',
                'message': '백업 생성 실패',
                'analysis': asdict(analysis),
                'conversion_results': []
            }
        
        # 3. 빌드 파일 업데이트
        build_update_success = self.update_build_files(analysis)
        
        # 4. 소스 파일 변환
        # Java 파일 변환
        java_files = list(self.project_root.rglob('*.java'))
        for java_file in java_files:
            if self._should_skip_file(java_file):
                continue
            result = self.convert_java_file(java_file)
            self.conversion_results.append(result)
        
        # Python 파일 변환
        python_files = list(self.project_root.rglob('*.py'))
        for python_file in python_files:
            if self._should_skip_file(python_file):
                continue
            result = self.convert_python_file(python_file)
            self.conversion_results.append(result)
        
        # 5. 결과 집계
        successful_conversions = [r for r in self.conversion_results if r.status == 'success']
        failed_conversions = [r for r in self.conversion_results if r.status == 'failed']
        skipped_conversions = [r for r in self.conversion_results if r.status == 'skipped']
        
        # 6. 변환 리포트 생성
        self._generate_conversion_report(analysis, build_update_success)
        
        logger.info(f"=== OpenTelemetry 변환 완료 ===")
        logger.info(f"성공: {len(successful_conversions)}개")
        logger.info(f"실패: {len(failed_conversions)}개") 
        logger.info(f"건너뜀: {len(skipped_conversions)}개")
        
        return {
            'status': 'completed',
            'analysis': asdict(analysis),
            'build_files_updated': build_update_success,
            'conversion_summary': {
                'total_files': len(self.conversion_results),
                'successful': len(successful_conversions),
                'failed': len(failed_conversions),
                'skipped': len(skipped_conversions)
            },
            'conversion_results': [asdict(r) for r in self.conversion_results]
        }

    def convert_project_with_options(self, include_java=True, include_python=True, 
                                   update_build_files=True, create_backup=True, 
                                   exclude_patterns=None):
        """
        옵션에 따른 프로젝트 변환 실행
        
        Args:
            include_java (bool): Java 파일 변환 포함 여부
            include_python (bool): Python 파일 변환 포함 여부
            update_build_files (bool): 빌드 파일 업데이트 여부
            create_backup (bool): 백업 생성 여부
            exclude_patterns (list): 제외할 패턴 목록
            
        Returns:
            Dict: 변환 결과 요약
        """
        logger.info("=== OpenTelemetry 옵션별 변환 시작 ===")
        logger.info(f"Java 포함: {include_java}, Python 포함: {include_python}")
        logger.info(f"빌드 파일 업데이트: {update_build_files}, 백업 생성: {create_backup}")
        
        # 제외 패턴 설정
        if exclude_patterns:
            self.exclude_patterns = exclude_patterns
        
        # 1. 프로젝트 분석
        analysis = self.analyze_project()
        
        if analysis.existing_otel:
            logger.warning("이미 OpenTelemetry가 적용된 프로젝트입니다")
            return {
                'status': 'skipped',
                'message': '이미 OpenTelemetry가 적용된 프로젝트',
                'analysis': asdict(analysis),
                'conversion_results': []
            }
        
        # 2. 백업 생성 (옵션)
        if create_backup and not self.create_backup():
            return {
                'status': 'failed',
                'message': '백업 생성 실패',
                'analysis': asdict(analysis),
                'conversion_results': []
            }
        
        # 3. 빌드 파일 업데이트 (옵션)
        build_update_success = True
        if update_build_files:
            build_update_success = self.update_build_files(analysis)
        
        # 4. 소스 파일 변환
        # Java 파일 변환 (옵션)
        if include_java:
            java_files = list(self.project_root.rglob('*.java'))
            for java_file in java_files:
                if self._should_skip_file(java_file):
                    continue
                result = self.convert_java_file(java_file)
                self.conversion_results.append(result)
        
        # Python 파일 변환 (옵션)
        if include_python:
            python_files = list(self.project_root.rglob('*.py'))
            for python_file in python_files:
                if self._should_skip_file(python_file):
                    continue
                result = self.convert_python_file(python_file)
                self.conversion_results.append(result)
        
        # 5. 결과 집계
        successful_conversions = [r for r in self.conversion_results if r.status == 'success']
        failed_conversions = [r for r in self.conversion_results if r.status == 'failed']
        skipped_conversions = [r for r in self.conversion_results if r.status == 'skipped']
        
        # 6. 변환 리포트 생성
        self._generate_conversion_report(analysis, build_update_success)
        
        logger.info(f"=== OpenTelemetry 옵션별 변환 완료 ===")
        logger.info(f"성공: {len(successful_conversions)}개")
        logger.info(f"실패: {len(failed_conversions)}개") 
        logger.info(f"건너뜀: {len(skipped_conversions)}개")
        
        return {
            'status': 'completed',
            'success': True,
            'analysis': asdict(analysis),
            'build_files_updated': build_update_success,
            'conversion_summary': {
                'total_files': len(self.conversion_results),
                'successful': len(successful_conversions),
                'failed': len(failed_conversions),
                'skipped': len(skipped_conversions)
            },
            'conversion_results': [asdict(r) for r in self.conversion_results]
        }

    def _should_skip_file(self, file_path: Path) -> bool:
        """파일을 건너뛸지 확인"""
        default_skip_patterns = [
            'test', 'tests', 'target', 'build', '.git', 
            '__pycache__', '.pytest_cache', 'node_modules',
            '.otel_backup'
        ]
        
        # 사용자 정의 제외 패턴과 기본 패턴 합치기
        all_skip_patterns = default_skip_patterns + self.exclude_patterns
        
        str_path = str(file_path).lower()
        return any(pattern.lower() in str_path for pattern in all_skip_patterns)

    def _generate_conversion_report(self, analysis: ProjectAnalysis, build_success: bool):
        """변환 리포트 생성"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_path = self.project_root / f'opentelemetry_conversion_report_{timestamp}.json'
        
        report = {
            'timestamp': timestamp,
            'project_analysis': asdict(analysis),
            'build_files_updated': build_success,
            'conversion_results': [asdict(r) for r in self.conversion_results],
            'summary': {
                'total_files': len(self.conversion_results),
                'successful': len([r for r in self.conversion_results if r.status == 'success']),
                'failed': len([r for r in self.conversion_results if r.status == 'failed']),
                'skipped': len([r for r in self.conversion_results if r.status == 'skipped'])
            }
        }
        
        try:
            with open(report_path, 'w', encoding='utf-8') as f:
                json.dump(report, f, indent=2, ensure_ascii=False)
            logger.info(f"변환 리포트 생성: {report_path}")
        except Exception as e:
            logger.error(f"리포트 생성 실패: {e}")

def main():
    """메인 함수"""
    import argparse
    import os
    
    parser = argparse.ArgumentParser(description='OpenTelemetry SDK 자동 적용 도구')
    parser.add_argument('git_directory', help='.git 디렉토리가 있는 프로젝트 경로')
    parser.add_argument('--dry-run', action='store_true', help='실제 변환 없이 분석만 수행')
    parser.add_argument('--backup-only', action='store_true', help='백업만 생성')
    
    args = parser.parse_args()
    
    try:
        converter = OpenTelemetryConverter(args.git_directory)
        
        if args.dry_run:
            # 분석만 수행
            analysis = converter.analyze_project()
            print(json.dumps(asdict(analysis), indent=2, ensure_ascii=False))
        elif args.backup_only:
            # 백업만 생성
            success = converter.create_backup()
            print(json.dumps({"success": success, "message": f"백업 {'성공' if success else '실패'}"}, indent=2, ensure_ascii=False))
        else:
            # 전체 변환 수행 (환경 변수에서 옵션 읽기)
            include_java = os.getenv('OTEL_INCLUDE_JAVA', 'true').lower() == 'true'
            include_python = os.getenv('OTEL_INCLUDE_PYTHON', 'true').lower() == 'true' 
            update_build_files = os.getenv('OTEL_UPDATE_BUILD_FILES', 'true').lower() == 'true'
            create_backup = os.getenv('OTEL_CREATE_BACKUP', 'true').lower() == 'true'
            exclude_patterns = os.getenv('OTEL_EXCLUDE_PATTERNS', '').split(',')
            
            # 옵션에 따라 변환 실행
            result = converter.convert_project_with_options(
                include_java=include_java,
                include_python=include_python,
                update_build_files=update_build_files,
                create_backup=create_backup,
                exclude_patterns=[p.strip() for p in exclude_patterns if p.strip()]
            )
            print(json.dumps(result, indent=2, ensure_ascii=False))
            
    except Exception as e:
        logger.error(f"실행 중 오류 발생: {e}")
        # JSON 형태로 에러 반환
        error_result = {
            "success": False,
            "error": str(e),
            "status": "failed"
        }
        print(json.dumps(error_result, indent=2, ensure_ascii=False))

if __name__ == '__main__':
    main()