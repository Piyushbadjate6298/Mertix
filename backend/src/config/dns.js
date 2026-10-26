import dns from 'node:dns';

// Ensure we only install the fallback once
if (!globalThis.__MERITX_DNS_FALLBACK_INSTALLED__) {
  globalThis.__MERITX_DNS_FALLBACK_INSTALLED__ = true;

  const origLookup = dns.lookup;
  const resolver = new dns.promises.Resolver();
  // Fallback to high-availability public DNS providers (Cloudflare & Google)
  // when local ISP DNS (e.g., JioFiber / Airtel) refuses AWS/Neon cloud domains
  resolver.setServers(['1.1.1.1', '8.8.8.8', '1.0.0.1', '8.8.4.4']);

  dns.lookup = function (hostname, options, callback) {
    let cb = callback;
    let opts = options;

    if (typeof options === 'function') {
      cb = options;
      opts = {};
    } else if (typeof options === 'number') {
      opts = { family: options };
    } else if (!opts) {
      opts = {};
    }

    origLookup.call(dns, hostname, opts, async (err, address, family) => {
      // If OS resolver succeeds or hostname is IP/localhost, return as-is
      if (!err || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        return cb(err, address, family);
      }

      try {
        const want6 = opts.family === 6;
        let ips = [];

        if (want6) {
          ips = await resolver.resolve6(hostname).catch(() => []);
        }
        if (!ips.length) {
          ips = await resolver.resolve4(hostname).catch(() => []);
        }

        if (!ips.length) {
          return cb(err, address, family);
        }

        if (opts.all) {
          const results = ips.map((ip) => ({
            address: ip,
            family: ip.includes(':') ? 6 : 4,
          }));
          return cb(null, results);
        }

        const ip = ips[0];
        return cb(null, ip, ip.includes(':') ? 6 : 4);
      } catch {
        return cb(err, address, family);
      }
    });
  };
}

export default dns;
