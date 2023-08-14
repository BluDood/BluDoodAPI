export const method = 'get'
export const name = '/ip'

export const handler = async (req, res) => {
  return res.send(req.headers['x-forwarded-for'] || req.ip)
}
