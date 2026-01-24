import time
import requests
import sys

BASE_URL = "http://localhost:8080"

def benchmark_unlock(url):
    print(f"Benchmarking Unlock: {url}")
    start = time.time()
    try:
        response = requests.post(f"{BASE_URL}/api/unlock", json={"url": url})
        duration = time.time() - start
        
        if response.status_code == 200:
            print(f"SUCCESS: {duration:.4f}s")
            # Check for header time if available
            server_time = response.headers.get("X-Process-Time")
            if server_time:
                print(f"  Server Processing Time: {server_time}s")
                print(f"  Network/Overhead: {duration - float(server_time):.4f}s")
        else:
            print(f"FAILED: {response.status_code} - {response.text} ({duration:.4f}s)")
            
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        target_url = sys.argv[1]
    else:
        target_url = "https://medium.com/@joshuap/the-future-of-ai-is-personal-1234567890" # Example
        
    print(f"--- Nook Performance Benchmark ---")
    benchmark_unlock(target_url)
    print(f"----------------------------------")
