export interface CalculatorResult {
  value: number;
  operation: string;
  operands: number[];
}

export class Calculator {
  private history: CalculatorResult[] = [];

  add(a: number, b: number): CalculatorResult {
    const result = a + b;
    const operation: CalculatorResult = {
      value: result,
      operation: 'add',
      operands: [a, b]
    };
    this.history.push(operation);
    return operation;
  }

  subtract(a: number, b: number): CalculatorResult {
    const result = a - b;
    const operation: CalculatorResult = {
      value: result,
      operation: 'subtract',
      operands: [a, b]
    };
    this.history.push(operation);
    return operation;
  }

  multiply(a: number, b: number): CalculatorResult {
    const result = a * b;
    const operation: CalculatorResult = {
      value: result,
      operation: 'multiply',
      operands: [a, b]
    };
    this.history.push(operation);
    return operation;
  }

  divide(a: number, b: number): CalculatorResult {
    if (b === 0) {
      throw new Error('Division by zero is not allowed');
    }
    const result = a / b;
    const operation: CalculatorResult = {
      value: result,
      operation: 'divide',
      operands: [a, b]
    };
    this.history.push(operation);
    return operation;
  }

  getHistory(): CalculatorResult[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }
}