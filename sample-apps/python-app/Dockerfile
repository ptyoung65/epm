FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY main.py .

# Set environment variables for OpenTelemetry
ENV OTEL_SERVICE_NAME="python-sample-app"
ENV OTEL_EXPORTER_OTLP_ENDPOINT="http://otel-collector:4317"
ENV OTEL_EXPORTER_OTLP_PROTOCOL="grpc"
ENV OTEL_RESOURCE_ATTRIBUTES="service.name=python-sample-app,service.version=1.0.0,deployment.environment=production"
ENV OTEL_PYTHON_LOGGING_AUTO_INSTRUMENTATION_ENABLED="true"
ENV PYTHONUNBUFFERED=1

EXPOSE 8081

CMD ["python", "main.py"]