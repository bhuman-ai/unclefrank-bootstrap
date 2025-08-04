import { Calculator } from './calculator';

function runTests(): void {
  const calculator = new Calculator();
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void): void {
    try {
      fn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`✗ ${name}: ${message}`);
      failed++;
    }
  }

  function assertEqual(actual: any, expected: any): void {
    if (actual !== expected) {
      throw new Error(`Expected ${expected}, but got ${actual}`);
    }
  }

  function assertThrows(fn: () => void, expectedMessage?: string): void {
    try {
      fn();
      throw new Error('Expected function to throw an error');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (expectedMessage && message !== expectedMessage) {
        throw new Error(`Expected error message "${expectedMessage}", but got "${message}"`);
      }
    }
  }

  test('Addition works correctly', () => {
    const result = calculator.add(5, 3);
    assertEqual(result.value, 8);
    assertEqual(result.operation, 'add');
    assertEqual(result.operands.length, 2);
    assertEqual(result.operands[0], 5);
    assertEqual(result.operands[1], 3);
  });

  test('Subtraction works correctly', () => {
    const result = calculator.subtract(10, 4);
    assertEqual(result.value, 6);
    assertEqual(result.operation, 'subtract');
    assertEqual(result.operands[0], 10);
    assertEqual(result.operands[1], 4);
  });

  test('Multiplication works correctly', () => {
    const result = calculator.multiply(6, 7);
    assertEqual(result.value, 42);
    assertEqual(result.operation, 'multiply');
    assertEqual(result.operands[0], 6);
    assertEqual(result.operands[1], 7);
  });

  test('Division works correctly', () => {
    const result = calculator.divide(15, 3);
    assertEqual(result.value, 5);
    assertEqual(result.operation, 'divide');
    assertEqual(result.operands[0], 15);
    assertEqual(result.operands[1], 3);
  });

  test('Division by zero throws error', () => {
    assertThrows(() => calculator.divide(10, 0), 'Division by zero is not allowed');
  });

  test('History tracks operations', () => {
    const newCalculator = new Calculator();
    newCalculator.add(1, 2);
    newCalculator.multiply(3, 4);
    const history = newCalculator.getHistory();
    assertEqual(history.length, 2);
    assertEqual(history[0].operation, 'add');
    assertEqual(history[1].operation, 'multiply');
  });

  test('Clear history works', () => {
    const newCalculator = new Calculator();
    newCalculator.add(1, 2);
    newCalculator.clearHistory();
    assertEqual(newCalculator.getHistory().length, 0);
  });

  test('Decimal operations work correctly', () => {
    const result = calculator.add(0.1, 0.2);
    assertEqual(Math.round(result.value * 10) / 10, 0.3);
  });

  console.log(`\nTest Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests if this file is executed directly
runTests();

export { runTests };