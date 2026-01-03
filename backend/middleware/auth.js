const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'holdem-secret-key-change-in-production'

const TOKEN_EXPIRY = '7d'

function generateToken(playerId, gameId) {
  return jwt.sign({ playerId, gameId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY })
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (error) {
    return null
  }
}

function extractToken(authHeader) {
  if (!authHeader) return null
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  return authHeader
}

async function getPlayerIdFromRequest(req) {
  const authHeader = req.headers.authorization
  const token = extractToken(authHeader)

  if (token) {
    const decoded = verifyToken(token)
    if (decoded && decoded.playerId) {
      return decoded.playerId
    }
  }

  if (req.session && req.session.playerId) {
    return req.session.playerId
  }

  return null
}

function requireAuth(req, res, next) {
  getPlayerIdFromRequest(req)
    .then((playerId) => {
      if (!playerId) {
        return res.status(401).json({ error: 'Not authenticated' })
      }
      req.playerId = playerId
      next()
    })
    .catch(next)
}

module.exports = {
  generateToken,
  verifyToken,
  extractToken,
  getPlayerIdFromRequest,
  requireAuth,
  JWT_SECRET,
}
