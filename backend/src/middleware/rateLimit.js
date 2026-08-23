

function rateLimit({ windowMs, max, message }) {
  const hits = new Map();

  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    const timestamps = (hits.get(key) ?? []).filter((t) => t > windowStart);
    timestamps.push(now);
    hits.set(key, timestamps);

    if (timestamps.length > max) {
      res.status(429).json({ error: message ?? "Too many requests. Please try again later." });
      return;
    }

    next();
  };
}

module.exports = { rateLimit };
