export class NotSupportedError extends Error {
  constructor(methodName: string) {
    super(`Method "${methodName}" is not supported on this platform`);
    this.name = 'NotSupportedError';
  }
}