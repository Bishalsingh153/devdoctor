export class UserFacingError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "UserFacingError";
    this.exitCode = exitCode;
  }
}

export class ScanCacheCorruptError extends UserFacingError {
  constructor() {
    super("Scan cache is corrupted. Run devdoctor scan again.");
    this.name = "ScanCacheCorruptError";
  }
}
