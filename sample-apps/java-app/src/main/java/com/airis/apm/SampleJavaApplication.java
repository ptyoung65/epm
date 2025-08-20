package com.airis.apm;

import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.metrics.LongCounter;
import io.opentelemetry.api.metrics.Meter;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanKind;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.context.Scope;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Repository;
import org.springframework.web.bind.annotation.*;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Random;
import java.util.concurrent.ThreadLocalRandom;

@SpringBootApplication
@EnableScheduling
@Slf4j
public class SampleJavaApplication {
    
    public static void main(String[] args) {
        SpringApplication.run(SampleJavaApplication.class, args);
    }
}

@Entity
@Table(name = "orders")
@Data
class Order {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String customerName;
    private String productName;
    private Integer quantity;
    private Double price;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

@Repository
interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByStatus(String status);
    List<Order> findByCustomerName(String customerName);
}

@RestController
@RequestMapping("/api/orders")
@Slf4j
class OrderController {
    
    private final OrderRepository orderRepository;
    private final Tracer tracer;
    private final Meter meter;
    private final LongCounter orderCounter;
    private final LongCounter errorCounter;
    
    @Autowired
    public OrderController(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
        this.tracer = GlobalOpenTelemetry.getTracer("java-sample-app", "1.0.0");
        this.meter = GlobalOpenTelemetry.getMeter("java-sample-app");
        this.orderCounter = meter.counterBuilder("orders.created")
                .setDescription("Number of orders created")
                .setUnit("1")
                .build();
        this.errorCounter = meter.counterBuilder("orders.errors")
                .setDescription("Number of order processing errors")
                .setUnit("1")
                .build();
    }
    
    @GetMapping
    public ResponseEntity<List<Order>> getAllOrders() {
        Span span = tracer.spanBuilder("getAllOrders")
                .setSpanKind(SpanKind.SERVER)
                .startSpan();
        
        try (Scope scope = span.makeCurrent()) {
            log.info("Fetching all orders");
            span.setAttribute("operation", "getAllOrders");
            
            List<Order> orders = orderRepository.findAll();
            span.setAttribute("orders.count", orders.size());
            
            // Simulate some processing time
            Thread.sleep(ThreadLocalRandom.current().nextInt(10, 50));
            
            return ResponseEntity.ok(orders);
        } catch (Exception e) {
            span.recordException(e);
            span.setStatus(StatusCode.ERROR, "Failed to fetch orders");
            errorCounter.add(1);
            log.error("Error fetching orders", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        } finally {
            span.end();
        }
    }
    
    @GetMapping("/{id}")
    public ResponseEntity<Order> getOrderById(@PathVariable Long id) {
        Span span = tracer.spanBuilder("getOrderById")
                .setSpanKind(SpanKind.SERVER)
                .startSpan();
        
        try (Scope scope = span.makeCurrent()) {
            span.setAttribute("order.id", id);
            log.info("Fetching order with id: {}", id);
            
            Optional<Order> order = orderRepository.findById(id);
            
            if (order.isPresent()) {
                span.setAttribute("order.found", true);
                return ResponseEntity.ok(order.get());
            } else {
                span.setAttribute("order.found", false);
                return ResponseEntity.notFound().build();
            }
        } finally {
            span.end();
        }
    }
    
    @PostMapping
    public ResponseEntity<Order> createOrder(@RequestBody Order order) {
        Span span = tracer.spanBuilder("createOrder")
                .setSpanKind(SpanKind.SERVER)
                .startSpan();
        
        try (Scope scope = span.makeCurrent()) {
            span.setAttribute("customer.name", order.getCustomerName());
            span.setAttribute("product.name", order.getProductName());
            span.setAttribute("order.quantity", order.getQuantity());
            
            log.info("Creating new order for customer: {}", order.getCustomerName());
            
            // Simulate validation
            if (order.getQuantity() <= 0) {
                span.setStatus(StatusCode.ERROR, "Invalid quantity");
                errorCounter.add(1);
                return ResponseEntity.badRequest().build();
            }
            
            // Simulate processing delay
            Thread.sleep(ThreadLocalRandom.current().nextInt(20, 100));
            
            order.setStatus("PENDING");
            Order savedOrder = orderRepository.save(order);
            
            orderCounter.add(1);
            span.setAttribute("order.id", savedOrder.getId());
            span.setStatus(StatusCode.OK);
            
            log.info("Order created successfully with id: {}", savedOrder.getId());
            return ResponseEntity.status(HttpStatus.CREATED).body(savedOrder);
            
        } catch (Exception e) {
            span.recordException(e);
            span.setStatus(StatusCode.ERROR, "Failed to create order");
            errorCounter.add(1);
            log.error("Error creating order", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        } finally {
            span.end();
        }
    }
    
    @PutMapping("/{id}/status")
    public ResponseEntity<Order> updateOrderStatus(@PathVariable Long id, @RequestParam String status) {
        Span span = tracer.spanBuilder("updateOrderStatus")
                .setSpanKind(SpanKind.SERVER)
                .startSpan();
        
        try (Scope scope = span.makeCurrent()) {
            span.setAttribute("order.id", id);
            span.setAttribute("order.status.new", status);
            
            Optional<Order> orderOpt = orderRepository.findById(id);
            if (orderOpt.isPresent()) {
                Order order = orderOpt.get();
                span.setAttribute("order.status.old", order.getStatus());
                
                order.setStatus(status);
                Order updatedOrder = orderRepository.save(order);
                
                log.info("Order {} status updated from {} to {}", id, orderOpt.get().getStatus(), status);
                return ResponseEntity.ok(updatedOrder);
            } else {
                span.setStatus(StatusCode.ERROR, "Order not found");
                return ResponseEntity.notFound().build();
            }
        } finally {
            span.end();
        }
    }
    
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteOrder(@PathVariable Long id) {
        Span span = tracer.spanBuilder("deleteOrder")
                .setSpanKind(SpanKind.SERVER)
                .startSpan();
        
        try (Scope scope = span.makeCurrent()) {
            span.setAttribute("order.id", id);
            
            if (orderRepository.existsById(id)) {
                orderRepository.deleteById(id);
                log.info("Order {} deleted successfully", id);
                return ResponseEntity.noContent().build();
            } else {
                span.setStatus(StatusCode.ERROR, "Order not found");
                return ResponseEntity.notFound().build();
            }
        } finally {
            span.end();
        }
    }
}

@RestController
@RequestMapping("/api/health")
@Slf4j
class HealthController {
    
    private final Tracer tracer;
    
    public HealthController() {
        this.tracer = GlobalOpenTelemetry.getTracer("java-sample-app", "1.0.0");
    }
    
    @GetMapping
    public ResponseEntity<HealthStatus> health() {
        Span span = tracer.spanBuilder("healthCheck")
                .setSpanKind(SpanKind.SERVER)
                .startSpan();
        
        try (Scope scope = span.makeCurrent()) {
            HealthStatus status = new HealthStatus();
            status.setStatus("UP");
            status.setTimestamp(LocalDateTime.now());
            status.setService("java-sample-app");
            
            span.setAttribute("health.status", "UP");
            return ResponseEntity.ok(status);
        } finally {
            span.end();
        }
    }
    
    @Data
    static class HealthStatus {
        private String status;
        private LocalDateTime timestamp;
        private String service;
    }
}

@Slf4j
@org.springframework.stereotype.Component
class MetricsGenerator {
    
    private final Meter meter;
    private final Random random = new Random();
    
    public MetricsGenerator() {
        this.meter = GlobalOpenTelemetry.getMeter("java-sample-app");
    }
    
    @Scheduled(fixedDelay = 10000)
    public void generateMetrics() {
        // CPU usage simulation
        meter.gaugeBuilder("jvm.cpu.usage")
                .setDescription("JVM CPU usage")
                .setUnit("%")
                .buildWithCallback(measurement -> {
                    measurement.record(20 + random.nextDouble() * 60);
                });
        
        // Memory usage simulation
        meter.gaugeBuilder("jvm.memory.usage")
                .setDescription("JVM memory usage")
                .setUnit("MB")
                .buildWithCallback(measurement -> {
                    measurement.record(100 + random.nextDouble() * 400);
                });
        
        // Active connections simulation
        meter.gaugeBuilder("db.connections.active")
                .setDescription("Active database connections")
                .setUnit("1")
                .buildWithCallback(measurement -> {
                    measurement.record(5 + random.nextInt(20));
                });
        
        log.debug("Metrics generated");
    }
}