class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
  static notFound(path) { return new HttpError(404, `Not Found: ${path}`, 'NOT_FOUND'); }
}
module.exports = { HttpError };
