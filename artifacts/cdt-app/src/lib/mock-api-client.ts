// Mock API client for Vercel deployment
import { mockDashboardStats, mockAttendanceSnapshot, mockApiCall } from "./mock-data";
import { setBaseUrl } from "@workspace/api-client-react";

// Check if we're in Vercel deployment or mock mode
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === "true" || 
                      import.meta.env.MODE === "production" && 
                      !import.meta.env.VITE_API_URL;

export function enableMockMode() {
  // Override the real API calls with mock data
  if (USE_MOCK_DATA) {
    console.log("🎭 Mock API mode enabled");
    
    // Store original fetch
    const originalFetch = window.fetch;
    
    // Override fetch to intercept API calls
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      
      // Only intercept API calls
      if (url.startsWith('/api/')) {
        try {
          const endpoint = url;
          const mockData = await mockApiCall(endpoint);
          
          return new Response(JSON.stringify(mockData), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          });
        } catch (error) {
          console.error('Mock API error:', error);
          return new Response(JSON.stringify({ error: 'Mock API error' }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
            },
          });
        }
      }
      
      // Pass through non-API calls
      return originalFetch(input, init);
    };
    
    // Set base URL to empty to use relative paths
    setBaseUrl('');
  }
}

// Export mock data for direct use in components
export { mockDashboardStats, mockAttendanceSnapshot };
