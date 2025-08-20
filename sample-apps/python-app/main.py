#!/usr/bin/env python3
import os
import time
import random
import asyncio
import logging
import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.sql import func

# OpenTelemetry imports
from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.instrumentation.logging import LoggingInstrumentor
from opentelemetry.instrumentation.system_metrics import SystemMetricsInstrumentor
from opentelemetry.trace import Status, StatusCode
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sample_app.db")
engine = create_engine(DATABASE_URL, pool_size=20, max_overflow=30)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# OpenTelemetry Configuration
OTEL_ENDPOINT = os.getenv("OTEL_ENDPOINT", "otel-collector:4317")
SERVICE_NAME = "python-sample-app"
SERVICE_VERSION = "1.0.0"

# Create resource
resource = Resource.create({
    "service.name": SERVICE_NAME,
    "service.version": SERVICE_VERSION,
    "service.namespace": "airis-apm",
    "deployment.environment": "production",
    "service.instance.id": f"{SERVICE_NAME}-{os.getpid()}",
    "host.name": os.getenv("HOSTNAME", "localhost"),
})

# Setup tracing
trace.set_tracer_provider(TracerProvider(resource=resource))
tracer = trace.get_tracer(SERVICE_NAME, SERVICE_VERSION)

# Configure OTLP trace exporter
otlp_trace_exporter = OTLPSpanExporter(
    endpoint=OTEL_ENDPOINT,
    insecure=True,
)
span_processor = BatchSpanProcessor(otlp_trace_exporter)
trace.get_tracer_provider().add_span_processor(span_processor)

# Setup metrics
metric_reader = PeriodicExportingMetricReader(
    exporter=OTLPMetricExporter(
        endpoint=OTEL_ENDPOINT,
        insecure=True,
    ),
    export_interval_millis=10000,
)
metrics.set_meter_provider(MeterProvider(resource=resource, metric_readers=[metric_reader]))
meter = metrics.get_meter(SERVICE_NAME, SERVICE_VERSION)

# Create metrics
request_counter = meter.create_counter(
    name="http_requests_total",
    description="Total number of HTTP requests",
    unit="1",
)

error_counter = meter.create_counter(
    name="http_errors_total",
    description="Total number of HTTP errors",
    unit="1",
)

response_time_histogram = meter.create_histogram(
    name="http_request_duration_seconds",
    description="HTTP request duration in seconds",
    unit="s",
)

active_users_gauge = meter.create_up_down_counter(
    name="active_users",
    description="Number of active users",
    unit="1",
)

# Database models
class Product(Base):
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), index=True)
    description = Column(Text)
    price = Column(Float)
    quantity = Column(Integer)
    category = Column(String(50))
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer)
    customer_name = Column(String(100))
    quantity = Column(Integer)
    total_amount = Column(Float)
    status = Column(String(20))
    created_at = Column(DateTime, default=func.now())

Base.metadata.create_all(bind=engine)

# Pydantic models
class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str
    price: float = Field(..., gt=0)
    quantity: int = Field(..., ge=0)
    category: str

class ProductResponse(BaseModel):
    id: int
    name: str
    description: str
    price: float
    quantity: int
    category: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class TransactionCreate(BaseModel):
    product_id: int
    customer_name: str
    quantity: int = Field(..., gt=0)

class TransactionResponse(BaseModel):
    id: int
    product_id: int
    customer_name: str
    quantity: int
    total_amount: float
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    service: str
    version: str
    checks: Dict[str, Any]

# Background tasks
async def generate_metrics():
    """Generate synthetic metrics periodically"""
    while True:
        # Simulate CPU usage
        cpu_gauge = meter.create_observable_gauge(
            name="system_cpu_usage",
            callbacks=[lambda options: random.uniform(10, 90)],
            description="System CPU usage percentage",
            unit="%",
        )
        
        # Simulate memory usage
        memory_gauge = meter.create_observable_gauge(
            name="system_memory_usage",
            callbacks=[lambda options: random.uniform(30, 80)],
            description="System memory usage percentage",
            unit="%",
        )
        
        # Simulate active connections
        connections_gauge = meter.create_observable_gauge(
            name="db_connections_active",
            callbacks=[lambda options: random.randint(5, 50)],
            description="Active database connections",
            unit="1",
        )
        
        await asyncio.sleep(10)

# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info(f"Starting {SERVICE_NAME} v{SERVICE_VERSION}")
    
    # Start background metrics generation
    task = asyncio.create_task(generate_metrics())
    
    # Initialize sample data
    db = SessionLocal()
    try:
        if db.query(Product).count() == 0:
            sample_products = [
                Product(name="Laptop", description="High-performance laptop", price=1299.99, quantity=50, category="Electronics"),
                Product(name="Monitor", description="4K Ultra HD Monitor", price=599.99, quantity=30, category="Electronics"),
                Product(name="Keyboard", description="Mechanical gaming keyboard", price=149.99, quantity=100, category="Accessories"),
                Product(name="Mouse", description="Wireless gaming mouse", price=79.99, quantity=150, category="Accessories"),
                Product(name="Headset", description="Noise-cancelling headset", price=199.99, quantity=75, category="Audio"),
            ]
            db.add_all(sample_products)
            db.commit()
            logger.info("Sample products created")
    finally:
        db.close()
    
    yield
    
    # Shutdown
    task.cancel()
    logger.info(f"Shutting down {SERVICE_NAME}")

# Create FastAPI app
app = FastAPI(
    title=SERVICE_NAME,
    version=SERVICE_VERSION,
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instrument FastAPI
FastAPIInstrumentor.instrument_app(app)
SQLAlchemyInstrumentor().instrument(engine=engine)
RequestsInstrumentor().instrument()
LoggingInstrumentor().instrument()
SystemMetricsInstrumentor().instrument()

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Routes
@app.get("/")
async def root():
    with tracer.start_as_current_span("root_endpoint") as span:
        span.set_attribute("endpoint", "/")
        return {"message": "Python Sample App with OpenTelemetry", "version": SERVICE_VERSION}

@app.get("/health", response_model=HealthResponse)
async def health_check():
    with tracer.start_as_current_span("health_check") as span:
        try:
            # Check database connection
            db = SessionLocal()
            db.execute("SELECT 1")
            db.close()
            db_status = "healthy"
        except Exception as e:
            db_status = f"unhealthy: {str(e)}"
            span.record_exception(e)
        
        health_status = {
            "status": "UP" if db_status == "healthy" else "DOWN",
            "timestamp": datetime.utcnow(),
            "service": SERVICE_NAME,
            "version": SERVICE_VERSION,
            "checks": {
                "database": db_status,
                "memory": "healthy",
                "disk": "healthy",
            }
        }
        
        span.set_attribute("health.status", health_status["status"])
        return health_status

@app.get("/api/products", response_model=List[ProductResponse])
async def get_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    category: Optional[str] = None,
    db: Session = get_db()
):
    with tracer.start_as_current_span("get_products") as span:
        span.set_attribute("products.skip", skip)
        span.set_attribute("products.limit", limit)
        
        try:
            query = db.query(Product)
            if category:
                query = query.filter(Product.category == category)
                span.set_attribute("products.category", category)
            
            products = query.offset(skip).limit(limit).all()
            span.set_attribute("products.count", len(products))
            
            request_counter.add(1, {"method": "GET", "endpoint": "/api/products"})
            return products
            
        except Exception as e:
            span.record_exception(e)
            span.set_status(Status(StatusCode.ERROR))
            error_counter.add(1, {"method": "GET", "endpoint": "/api/products"})
            raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: int, db: Session = get_db()):
    with tracer.start_as_current_span("get_product") as span:
        span.set_attribute("product.id", product_id)
        
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            span.set_status(Status(StatusCode.ERROR, "Product not found"))
            raise HTTPException(status_code=404, detail="Product not found")
        
        span.set_attribute("product.name", product.name)
        request_counter.add(1, {"method": "GET", "endpoint": "/api/products/{id}"})
        return product

@app.post("/api/products", response_model=ProductResponse)
async def create_product(product: ProductCreate, db: Session = get_db()):
    with tracer.start_as_current_span("create_product") as span:
        span.set_attribute("product.name", product.name)
        span.set_attribute("product.category", product.category)
        
        try:
            db_product = Product(**product.dict())
            db.add(db_product)
            db.commit()
            db.refresh(db_product)
            
            span.set_attribute("product.id", db_product.id)
            request_counter.add(1, {"method": "POST", "endpoint": "/api/products"})
            
            # Simulate some processing
            time.sleep(random.uniform(0.01, 0.05))
            
            return db_product
            
        except Exception as e:
            span.record_exception(e)
            span.set_status(Status(StatusCode.ERROR))
            error_counter.add(1, {"method": "POST", "endpoint": "/api/products"})
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/transactions", response_model=TransactionResponse)
async def create_transaction(transaction: TransactionCreate, db: Session = get_db()):
    with tracer.start_as_current_span("create_transaction") as span:
        span.set_attribute("transaction.product_id", transaction.product_id)
        span.set_attribute("transaction.customer", transaction.customer_name)
        span.set_attribute("transaction.quantity", transaction.quantity)
        
        # Check product availability
        product = db.query(Product).filter(Product.id == transaction.product_id).first()
        if not product:
            span.set_status(Status(StatusCode.ERROR, "Product not found"))
            raise HTTPException(status_code=404, detail="Product not found")
        
        if product.quantity < transaction.quantity:
            span.set_status(Status(StatusCode.ERROR, "Insufficient stock"))
            raise HTTPException(status_code=400, detail="Insufficient stock")
        
        try:
            # Create transaction
            total_amount = product.price * transaction.quantity
            db_transaction = Transaction(
                product_id=transaction.product_id,
                customer_name=transaction.customer_name,
                quantity=transaction.quantity,
                total_amount=total_amount,
                status="COMPLETED"
            )
            
            # Update product quantity
            product.quantity -= transaction.quantity
            
            db.add(db_transaction)
            db.commit()
            db.refresh(db_transaction)
            
            span.set_attribute("transaction.id", db_transaction.id)
            span.set_attribute("transaction.total", total_amount)
            request_counter.add(1, {"method": "POST", "endpoint": "/api/transactions"})
            
            # Update active users metric
            active_users_gauge.add(1)
            
            # Record response time
            response_time_histogram.record(random.uniform(0.05, 0.2))
            
            return db_transaction
            
        except Exception as e:
            span.record_exception(e)
            span.set_status(Status(StatusCode.ERROR))
            error_counter.add(1, {"method": "POST", "endpoint": "/api/transactions"})
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/transactions", response_model=List[TransactionResponse])
async def get_transactions(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    status: Optional[str] = None,
    db: Session = get_db()
):
    with tracer.start_as_current_span("get_transactions") as span:
        span.set_attribute("transactions.skip", skip)
        span.set_attribute("transactions.limit", limit)
        
        query = db.query(Transaction)
        if status:
            query = query.filter(Transaction.status == status)
            span.set_attribute("transactions.status", status)
        
        transactions = query.offset(skip).limit(limit).all()
        span.set_attribute("transactions.count", len(transactions))
        
        request_counter.add(1, {"method": "GET", "endpoint": "/api/transactions"})
        return transactions

@app.get("/api/metrics")
async def get_metrics():
    """Custom metrics endpoint"""
    with tracer.start_as_current_span("get_metrics") as span:
        metrics_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "service": SERVICE_NAME,
            "metrics": {
                "requests_per_minute": random.randint(100, 1000),
                "average_response_time_ms": random.uniform(10, 100),
                "error_rate": random.uniform(0, 5),
                "active_connections": random.randint(10, 100),
                "cpu_usage": random.uniform(20, 80),
                "memory_usage": random.uniform(30, 70),
            }
        }
        
        for key, value in metrics_data["metrics"].items():
            span.set_attribute(f"metric.{key}", value)
        
        return metrics_data

@app.post("/api/simulate-error")
async def simulate_error(error_type: str = "random"):
    """Endpoint to simulate various types of errors for testing"""
    with tracer.start_as_current_span("simulate_error") as span:
        span.set_attribute("error.type", error_type)
        
        if error_type == "timeout":
            time.sleep(5)
            raise HTTPException(status_code=504, detail="Gateway Timeout")
        elif error_type == "database":
            span.set_status(Status(StatusCode.ERROR, "Database connection failed"))
            raise HTTPException(status_code=500, detail="Database connection failed")
        elif error_type == "validation":
            span.set_status(Status(StatusCode.ERROR, "Validation error"))
            raise HTTPException(status_code=400, detail="Invalid input data")
        else:
            if random.random() > 0.5:
                span.set_status(Status(StatusCode.ERROR, "Random error occurred"))
                error_counter.add(1, {"method": "POST", "endpoint": "/api/simulate-error"})
                raise HTTPException(status_code=500, detail="Random error occurred")
            
        return {"message": "No error occurred"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8081)