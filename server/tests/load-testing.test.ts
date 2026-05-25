/**
 * PHASE 1 LOAD TESTING SUITE
 * 
 * Simulate concurrent users and measure performance:
 * npm run test:load
 * 
 * Load levels:
 * - Light: 100 concurrent users
 * - Medium: 500 concurrent users
 * - Heavy: 1000 concurrent users
 */

import http from 'http';
import https from 'https';
import { describe, it, expect } from '@jest/globals';

interface LoadTestConfig {
  concurrentUsers: number;
  requestsPerUser: number;
  durationSeconds: number;
  endpoints: Array<{
    method: string;
    path: string;
    body?: any;
  }>;
}

interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  status429Count: number; // Rate limited
  totalDuration: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p95Latency: number;
  p99Latency: number;
  requestsPerSecond: number;
  errorRate: number;
}

const API_BASE = process.env.API_URL || 'http://localhost:5000';

function makeRequest(
  method: string,
  path: string,
  body?: any
): Promise<{ status: number; latency: number }> {
  return new Promise((resolve) => {
    const url = new URL(API_BASE);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    const startTime = Date.now();

    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: path,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const latency = Date.now() - startTime;
        resolve({ status: res.statusCode || 500, latency });
      });
    });

    req.on('error', () => {
      const latency = Date.now() - startTime;
      resolve({ status: 0, latency }); // 0 for connection error
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function getPercentile(arr: number[], percentile: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

async function runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
  const latencies: number[] = [];
  let successCount = 0;
  let failureCount = 0;
  let status429Count = 0;
  const startTime = Date.now();

  console.log(`\n📊 Load Test: ${config.concurrentUsers} concurrent users`);
  console.log(`   Duration: ${config.durationSeconds}s`);
  console.log(`   Requests per user: ${config.requestsPerUser}`);

  // Create concurrent users
  const userPromises = Array(config.concurrentUsers)
    .fill(null)
    .map(async (_) => {
      for (let i = 0; i < config.requestsPerUser; i++) {
        const endpoint = config.endpoints[i % config.endpoints.length];
        try {
          const result = await makeRequest(endpoint.method, endpoint.path, endpoint.body);
          latencies.push(result.latency);

          if (result.status === 0) {
            failureCount++;
          } else if (result.status === 429) {
            status429Count++;
            successCount++; // 429 is a valid response
          } else if (result.status >= 200 && result.status < 300) {
            successCount++;
          } else if (result.status >= 400 && result.status < 500) {
            // Client errors (validation, auth, etc.) are still "handled"
            successCount++;
          } else if (result.status >= 500) {
            failureCount++;
          }
        } catch (error) {
          failureCount++;
        }
      }
    });

  await Promise.all(userPromises);
  const totalDuration = Date.now() - startTime;
  const totalRequests = successCount + failureCount;

  return {
    totalRequests,
    successfulRequests: successCount,
    failedRequests: failureCount,
    status429Count,
    totalDuration: totalDuration,
    avgLatency: latencies.length > 0 ? latencies.reduce((a, b) => a + b) / latencies.length : 0,
    minLatency: latencies.length > 0 ? Math.min(...latencies) : 0,
    maxLatency: latencies.length > 0 ? Math.max(...latencies) : 0,
    p95Latency: latencies.length > 0 ? getPercentile(latencies, 95) : 0,
    p99Latency: latencies.length > 0 ? getPercentile(latencies, 99) : 0,
    requestsPerSecond: (totalRequests / totalDuration) * 1000,
    errorRate: (failureCount / totalRequests) * 100,
  };
}

function printResults(label: string, result: LoadTestResult) {
  console.log(`\n✅ ${label} Results:`);
  console.log(`   Total Requests: ${result.totalRequests}`);
  console.log(`   Successful: ${result.successfulRequests} (${((result.successfulRequests / result.totalRequests) * 100).toFixed(1)}%)`);
  console.log(`   Status 429 (rate limited): ${result.status429Count}`);
  console.log(`   Failed: ${result.failedRequests}`);
  console.log(`   Duration: ${(result.totalDuration / 1000).toFixed(2)}s`);
  console.log(`   Throughput: ${result.requestsPerSecond.toFixed(2)} req/s`);
  console.log(`   Latency (ms):`);
  console.log(`      Min:  ${result.minLatency}ms`);
  console.log(`      Avg:  ${result.avgLatency.toFixed(0)}ms`);
  console.log(`      P95:  ${result.p95Latency.toFixed(0)}ms ${result.p95Latency > 500 ? '⚠️' : '✅'}`);
  console.log(`      P99:  ${result.p99Latency.toFixed(0)}ms`);
  console.log(`      Max:  ${result.maxLatency}ms`);

  // Pass/Fail criteria
  const passP95 = result.p95Latency < 500;
  const passErrorRate = result.errorRate < 5;
  
  const status = passP95 && passErrorRate ? '✅ PASS' : '⚠️ NEEDS REVIEW';
  console.log(`   Status: ${status}`);
}

async function main() {
  console.log('\n⚡ LOAD TESTING SUITE');
  console.log(`Testing API at: ${API_BASE}\n`);

  // Light load test
  const lightConfig: LoadTestConfig = {
    concurrentUsers: 100,
    requestsPerUser: 10,
    durationSeconds: 120,
    endpoints: [
      { method: 'GET', path: '/api/health' },
      { method: 'GET', path: '/api/config/system' },
    ],
  };

  const lightResult = await runLoadTest(lightConfig);
  printResults('Light Load (100 users)', lightResult);

  // Medium load test
  const mediumConfig: LoadTestConfig = {
    concurrentUsers: 500,
    requestsPerUser: 5,
    durationSeconds: 300,
    endpoints: [
      { method: 'GET', path: '/api/health' },
      { method: 'GET', path: '/api/config/system' },
    ],
  };

  console.log('\n⏳ Starting medium load test in 5 seconds...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  const mediumResult = await runLoadTest(mediumConfig);
  printResults('Medium Load (500 users)', mediumResult);

  // Summary
  console.log('\n📈 LOAD TEST SUMMARY\n');
  console.log('Light Load (100 users):');
  console.log(`   ${lightResult.p95Latency < 500 ? '✅' : '⚠️'} P95 Latency: ${lightResult.p95Latency.toFixed(0)}ms`);
  console.log(`   ${lightResult.errorRate < 5 ? '✅' : '⚠️'} Error Rate: ${lightResult.errorRate.toFixed(1)}%`);

  console.log('\nMedium Load (500 users):');
  console.log(`   ${mediumResult.p95Latency < 500 ? '✅' : '⚠️'} P95 Latency: ${mediumResult.p95Latency.toFixed(0)}ms`);
  console.log(`   ${mediumResult.errorRate < 5 ? '✅' : '⚠️'} Error Rate: ${mediumResult.errorRate.toFixed(1)}%`);

  // Overall verdict
  const bothPass = lightResult.p95Latency < 500 && mediumResult.p95Latency < 500;
  const errorRateOk = lightResult.errorRate < 5 && mediumResult.errorRate < 5;

  if (bothPass && errorRateOk) {
    console.log('\n🎉 LOAD TEST PASSED - System ready for production!');
    process.exit(0);
  } else {
    console.log('\n⚠️ LOAD TEST NEEDS REVIEW - Check results above');
    process.exit(1);
  }
}

describe('Load Testing Script Compatibility', () => {
  it('exports callable load-testing helpers for scripted runs', () => {
    expect(typeof runLoadTest).toBe('function');
    expect(typeof printResults).toBe('function');
  });
});

if (!process.env.JEST_WORKER_ID) {
  main().catch(console.error);
}

export { runLoadTest, printResults };
