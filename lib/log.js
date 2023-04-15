module.exports = function log(message, name) {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale
  const time = new Intl.DateTimeFormat(locale, { timeStyle: 'medium' }).format(Date.now())
  console.log(`[${time}]${name ? ` <${name}>:` : ''} ${message}`)
}
