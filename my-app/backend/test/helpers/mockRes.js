function mockReq(overrides = {}) {
  return { ...overrides };
}
function mockRes() {
  const res = {};
  res.status = jest.fn().mockImplementation((c) => { res.statusCode = c; return res; });
  res.json   = jest.fn().mockImplementation((p) => { res.body = p; return res; });
  res.send   = jest.fn().mockImplementation((p) => { res.body = p; return res; });
  return res;
}
module.exports = { mockReq, mockRes };
