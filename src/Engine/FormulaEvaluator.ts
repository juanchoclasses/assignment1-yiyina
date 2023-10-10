import Cell from "./Cell"
import SheetMemory from "./SheetMemory"
import { ErrorMessages } from "./GlobalDefinitions";



export class FormulaEvaluator {
  // Define a function called update that takes a string parameter and returns a number
  private _errorOccured: boolean = false;
  private _errorMessage: string = "";
  private _currentFormula: FormulaType = [];
  private _lastResult: number = 0;
  private _sheetMemory: SheetMemory;
  private _result: number = 0;
  private _index: number = 0;

  constructor(memory: SheetMemory) {
    this._sheetMemory = memory;
  }

  /**
   * Evaluate a mathematical formula and calculate the result.
   *
   * @param formula The mathematical formula to evaluate.
   */
  evaluate(formula: FormulaType): void {
    this._currentFormula = [...formula];
    this._index = 0;
    this._errorOccured = false;
    this._errorMessage = "";
    this._result = 0;

    // if the formula is empty return ""
    if (formula.length === 0) {
      this._errorMessage = ErrorMessages.emptyFormula;
      this._result = 0;
      return;
    }
    
    try {
      // Evaluate the expression and calculate the result
      this._result = this.expression();

      // Check for any remaining tokens in the formula
      if (this._index < this._currentFormula.length) {
        this._errorMessage = ErrorMessages.invalidFormula;
      }
    } catch (error) {
      if (error instanceof Error) {
        this._errorMessage = error.message;
      } else {
        // Handle the case where error is not an instance of Error, if needed
        this._errorMessage = ErrorMessages.invalidFormula;
      }
    }
  }

  /**
   * Evaluate an arithmetic expression and return the result.
   *
   * @returns The value of the expression.
   */
  private expression(): number {
    let value = this.term();
    while (this._index < this._currentFormula.length && ['+', '-'].includes(this._currentFormula[this._index])) {
      const op = this._currentFormula[this._index++];
      if (this._index >= this._currentFormula.length) {
        this._errorMessage = ErrorMessages.invalidFormula;
        return value;
      }
      const rightValue = this.term();
      value = op === '+' ? value + rightValue : value - rightValue;
    }
    return value;
  }

  /**
   * Evaluate a term within the arithmetic expression and return the result.
   *
   * @returns The value of the term.
   */
  private term(): number {
    let value = this.factor();
    while (this._index < this._currentFormula.length && ['*', '/'].includes(this._currentFormula[this._index])) {
      const op = this._currentFormula[this._index++];
      if (this._index >= this._currentFormula.length) {
        this._errorMessage = ErrorMessages.invalidFormula;
        return value;
      }
      const rightValue = this.factor();
      if (op === '/' && rightValue === 0) {
        this._result = Infinity;
        throw new Error(ErrorMessages.divideByZero);
      }
      value = op === '*' ? value * rightValue : value / rightValue;
    }
    return value;
  }

  /**
   * Evaluate a factor within the arithmetic expression and return the result.
   *
   * @returns The value of the factor.
   */
  private factor(): number {
    if (this._index >= this._currentFormula.length) {
      throw new Error(ErrorMessages.invalidFormula);
    }

    // Check if the formula only has one unique number
    this.validateUniqueNumber(this._currentFormula);

    const token = this._currentFormula[this._index++];
    if (this.isNumber(token)) {
      return Number(token);
    } else if (this.isCellReference(token)) {
      const [value, error] = this.getCellValue(token);
      if (error) {
        throw new Error(error);
      }
      return value;
    } else if (token === '(') {
      const value = this.expression();
      if (this._index >= this._currentFormula.length || this._currentFormula[this._index++] !== ')') {
        throw new Error(ErrorMessages.missingParentheses);
      }
      return value;
    } else {
      throw new Error(ErrorMessages.invalidFormula);
    }
  }

  /**
   * Check if the formula only has one unique number or if it has open and closing parentheses with a number in between.
   * If the formula contains one number and one or more operators, set the error message to "invalid formula".
   *
   * @param formula The mathematical formula to check.
   */
  private validateUniqueNumber(formula: FormulaType): void {
    // If the formula only has 1 number, return that number
    if (formula.length === 1 && this.isNumber(formula[0])) {
      this._result = Number(formula[0]);
      return;
    }
    // Find out the only number
    let uniqueNumber: number | null = null;
    let uniqueNumberIndex: number | null = null;
    for (let i = 0; i < formula.length; i++) {
      const token = formula[i];
      if (this.isNumber(token)) {
        if (uniqueNumber !== null) {
          uniqueNumber = null;
          break;
        }
        uniqueNumber = Number(token);
        uniqueNumberIndex = i;
      } else if (!["(", ")", "+", "-", "*", "/"].includes(token)) {
        uniqueNumber = null;
        break;
      }
    }

    // if the formula is not null and the uniqueNumber is not sit at the first place and the uniqueNumber is not in the form of (number)
    // set error message to invalid formula
    if (
      uniqueNumber !== null &&
      uniqueNumberIndex !== null &&
      (uniqueNumberIndex === 0 || formula[uniqueNumberIndex - 1] !== "(") &&
      (uniqueNumberIndex === formula.length - 1 || formula[uniqueNumberIndex + 1] !== ")")
    ) {
      this._result = uniqueNumber;
      this._errorMessage = ErrorMessages.invalidFormula;
      return;
    }
  }

  public get error(): string {
    return this._errorMessage
  }

  public get result(): number {
    return this._result;
  }

  /**
   * 
   * @param token 
   * @returns true if the toke can be parsed to a number
   */
  isNumber(token: TokenType): boolean {
    return !isNaN(Number(token));
  }

  /**
   * 
   * @param token
   * @returns true if the token is a cell reference
   * 
   */
  isCellReference(token: TokenType): boolean {

    return Cell.isValidCellLabel(token);
  }

  /**
   * 
   * @param token
   * @returns [value, ""] if the cell formula is not empty and has no error
   * @returns [0, error] if the cell has an error
   * @returns [0, ErrorMessages.invalidCell] if the cell formula is empty
   * 
   */
  getCellValue(token: TokenType): [number, string] {

    let cell = this._sheetMemory.getCellByLabel(token);
    let formula = cell.getFormula();
    let error = cell.getError();

    // if the cell has an error return 0
    if (error !== "" && error !== ErrorMessages.emptyFormula) {
      return [0, error];
    }

    // if the cell formula is empty return 0
    if (formula.length === 0) {
      return [0, ErrorMessages.invalidCell];
    }


    let value = cell.getValue();
    return [value, ""];

  }


}

export default FormulaEvaluator;