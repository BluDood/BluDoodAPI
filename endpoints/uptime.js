export const method = 'get'
export const name = '/uptime'

export const handler = (req, res) => {
  return res.status(200).json({
    uptime: process.uptime().toFixed(2)
  })
}
