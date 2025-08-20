import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Random;
import java.util.Timer;
import java.util.TimerTask;

public class SimpleApp {
    private static final HttpClient client = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .build();
    
    private static final Random random = new Random();
    
    public static void main(String[] args) {
        System.out.println("🚀 Simple Java App with OpenTelemetry started!");
        
        // Generate some sample data
        Timer timer = new Timer();
        timer.scheduleAtFixedRate(new TimerTask() {
            @Override
            public void run() {
                generateSampleActivity();
            }
        }, 0, 5000); // Every 5 seconds
        
        // Keep the application running
        try {
            Thread.currentThread().join();
        } catch (InterruptedException e) {
            timer.cancel();
        }
    }
    
    private static void generateSampleActivity() {
        try {
            // Simulate different types of operations
            String operation = getRandomOperation();
            System.out.println("📊 Executing: " + operation);
            
            switch (operation) {
                case "database_query":
                    simulateDatabaseQuery();
                    break;
                case "api_call":
                    simulateApiCall();
                    break;
                case "cache_operation":
                    simulateCacheOperation();
                    break;
                case "error_scenario":
                    simulateError();
                    break;
                default:
                    simulateProcessing();
                    break;
            }
            
        } catch (Exception e) {
            System.err.println("❌ Error in operation: " + e.getMessage());
        }
    }
    
    private static String getRandomOperation() {
        String[] operations = {
            "database_query", "api_call", "cache_operation", 
            "processing", "processing", "processing", // More processing operations
            "error_scenario" // Occasional errors
        };
        return operations[random.nextInt(operations.length)];
    }
    
    private static void simulateDatabaseQuery() throws InterruptedException {
        long startTime = System.currentTimeMillis();
        
        // Simulate query time
        Thread.sleep(50 + random.nextInt(200)); // 50-250ms
        
        long duration = System.currentTimeMillis() - startTime;
        System.out.println("  🗃️  Database query completed in " + duration + "ms");
        
        // Send data to OpenTelemetry (simulate)
        sendMetric("database_query_duration", duration);
        sendMetric("database_connections_active", 5 + random.nextInt(15));
    }
    
    private static void simulateApiCall() throws InterruptedException {
        long startTime = System.currentTimeMillis();
        
        // Simulate API call time
        Thread.sleep(100 + random.nextInt(300)); // 100-400ms
        
        long duration = System.currentTimeMillis() - startTime;
        System.out.println("  🌐 API call completed in " + duration + "ms");
        
        sendMetric("api_call_duration", duration);
        sendMetric("http_requests_total", 1);
    }
    
    private static void simulateCacheOperation() throws InterruptedException {
        long startTime = System.currentTimeMillis();
        
        // Simulate cache operation (much faster)
        Thread.sleep(5 + random.nextInt(20)); // 5-25ms
        
        long duration = System.currentTimeMillis() - startTime;
        System.out.println("  ⚡ Cache operation completed in " + duration + "ms");
        
        sendMetric("cache_operation_duration", duration);
    }
    
    private static void simulateProcessing() throws InterruptedException {
        long startTime = System.currentTimeMillis();
        
        // Simulate general processing
        Thread.sleep(20 + random.nextInt(100)); // 20-120ms
        
        long duration = System.currentTimeMillis() - startTime;
        System.out.println("  ⚙️  Processing completed in " + duration + "ms");
        
        sendMetric("processing_duration", duration);
        sendMetric("cpu_usage_percent", 20 + random.nextInt(60));
        sendMetric("memory_usage_percent", 30 + random.nextInt(50));
    }
    
    private static void simulateError() {
        System.err.println("  ❌ Simulated error occurred!");
        sendMetric("error_count", 1);
        sendMetric("error_rate_percent", random.nextInt(10));
    }
    
    private static void sendMetric(String name, double value) {
        // In a real application, this would send to OpenTelemetry
        // For now, we'll just simulate the metric collection
        System.out.println("    📈 Metric: " + name + " = " + value);
    }
}