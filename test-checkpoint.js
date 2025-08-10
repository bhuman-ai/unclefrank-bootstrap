const testCases = [
  {
    name: 'Authentication Check - PASS',
    payload: {
      checkpointId: 'auth-check',
      data: { authToken: 'valid-token-12345' }
    },
    expectedStatus: 'PASS'
  },
  {
    name: 'Authentication Check - FAIL',
    payload: {
      checkpointId: 'auth-check',
      data: { authToken: 'short' }
    },
    expectedStatus: 'FAIL'
  },
  {
    name: 'Data Validation - PASS',
    payload: {
      checkpointId: 'data-validation',
      data: { name: 'John', email: 'john@example.com' },
      conditions: { requiredFields: ['name', 'email'] }
    },
    expectedStatus: 'PASS'
  },
  {
    name: 'Data Validation - FAIL',
    payload: {
      checkpointId: 'data-validation',
      data: { name: 'John' },
      conditions: { requiredFields: ['name', 'email', 'phone'] }
    },
    expectedStatus: 'FAIL'
  },
  {
    name: 'Permission Check - PASS',
    payload: {
      checkpointId: 'permission-check',
      data: { userRole: 'admin', requiredPermission: 'delete' }
    },
    expectedStatus: 'PASS'
  },
  {
    name: 'Permission Check - FAIL',
    payload: {
      checkpointId: 'permission-check',
      data: { userRole: 'guest', requiredPermission: 'delete' }
    },
    expectedStatus: 'FAIL'
  },
  {
    name: 'Rate Limit - PASS',
    payload: {
      checkpointId: 'rate-limit',
      data: { requestCount: 50, maxRequests: 100 }
    },
    expectedStatus: 'PASS'
  },
  {
    name: 'Rate Limit - FAIL',
    payload: {
      checkpointId: 'rate-limit',
      data: { requestCount: 150, maxRequests: 100 }
    },
    expectedStatus: 'FAIL'
  },
  {
    name: 'Input Sanitization - PASS',
    payload: {
      checkpointId: 'input-sanitization',
      data: { input: 'Hello world, this is clean text!' }
    },
    expectedStatus: 'PASS'
  },
  {
    name: 'Input Sanitization - FAIL',
    payload: {
      checkpointId: 'input-sanitization',
      data: { input: 'Hello <script>alert("XSS")</script>' }
    },
    expectedStatus: 'FAIL'
  },
  {
    name: 'Business Rules - PASS',
    payload: {
      checkpointId: 'business-rules',
      data: { age: 25, country: 'USA' },
      conditions: {
        rules: [
          { field: 'age', operator: 'greater_than', value: 18 },
          { field: 'country', operator: 'equals', value: 'USA' }
        ]
      }
    },
    expectedStatus: 'PASS'
  },
  {
    name: 'Business Rules - FAIL',
    payload: {
      checkpointId: 'business-rules',
      data: { age: 15, country: 'USA' },
      conditions: {
        rules: [
          { field: 'age', operator: 'greater_than', value: 18 }
        ]
      }
    },
    expectedStatus: 'FAIL'
  },
  {
    name: 'Threshold Check - PASS',
    payload: {
      checkpointId: 'threshold-check',
      data: { temperature: 25, pressure: 1013 },
      conditions: {
        thresholds: {
          temperature: { min: 0, max: 40 },
          pressure: { min: 900, max: 1100 }
        }
      }
    },
    expectedStatus: 'PASS'
  },
  {
    name: 'Threshold Check - FAIL',
    payload: {
      checkpointId: 'threshold-check',
      data: { temperature: 50, pressure: 1013 },
      conditions: {
        thresholds: {
          temperature: { min: 0, max: 40 }
        }
      }
    },
    expectedStatus: 'FAIL'
  },
  {
    name: 'Format Validation - PASS',
    payload: {
      checkpointId: 'format-validation',
      data: { email: 'user@example.com', date: '2024-01-15' },
      conditions: {
        formats: {
          email: 'email',
          date: 'date'
        }
      }
    },
    expectedStatus: 'PASS'
  },
  {
    name: 'Format Validation - FAIL',
    payload: {
      checkpointId: 'format-validation',
      data: { email: 'invalid-email', date: '2024-01-15' },
      conditions: {
        formats: {
          email: 'email'
        }
      }
    },
    expectedStatus: 'FAIL'
  }
];

async function runTests() {
  console.log('Testing Uncle Frank\'s Checkpoint System\n');
  console.log('=' .repeat(50));
  
  let passedTests = 0;
  let failedTests = 0;

  for (const test of testCases) {
    try {
      const response = await fetch('http://localhost:3000/api/checkpoint/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(test.payload)
      });

      const result = await response.json();
      const testPassed = result.status === test.expectedStatus;

      if (testPassed) {
        console.log(`✅ ${test.name}`);
        console.log(`   Status: ${result.status} (Expected: ${test.expectedStatus})`);
        console.log(`   Message: ${result.message}`);
        passedTests++;
      } else {
        console.log(`❌ ${test.name}`);
        console.log(`   Status: ${result.status} (Expected: ${test.expectedStatus})`);
        console.log(`   Message: ${result.message}`);
        failedTests++;
      }
      
      if (result.details) {
        console.log(`   Details: ${JSON.stringify(result.details)}`);
      }
      console.log();
      
    } catch (error) {
      console.log(`❌ ${test.name}`);
      console.log(`   Error: ${error.message}`);
      failedTests++;
      console.log();
    }
  }

  console.log('=' .repeat(50));
  console.log(`\nTest Results:`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`Total: ${testCases.length}`);
  console.log(`Success Rate: ${((passedTests / testCases.length) * 100).toFixed(1)}%`);
}

if (typeof window === 'undefined') {
  const fetch = require('node-fetch');
  global.fetch = fetch;
  runTests().catch(console.error);
} else {
  runTests().catch(console.error);
}