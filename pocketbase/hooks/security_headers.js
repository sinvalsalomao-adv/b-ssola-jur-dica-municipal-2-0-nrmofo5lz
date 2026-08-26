// Security headers middleware for all HTTP responses
routerUse((e) => {
  const res = e.response
  if (res) {
    res
      .header()
      .set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.goskip.app https://*.goskip.dev; frame-src 'self' https://www.youtube.com https://player.vimeo.com;",
      )
    res.header().set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
    res.header().set('X-Frame-Options', 'DENY')
    res.header().set('X-Content-Type-Options', 'nosniff')
    res.header().set('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.header().set('X-XSS-Protection', '1; mode=block')
    res.header().set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  }

  return e.next()
})
