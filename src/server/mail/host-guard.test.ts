import { describe, expect, it } from 'vitest';
import { isPrivateAddress, privateHostsAllowed, resolveSmtpTarget } from './host-guard';

const PRODUCTION = { NODE_ENV: 'production' };

describe('destinos SMTP internos (SSRF)', () => {
  it('reconoce direcciones privadas, de loopback, link-local y reservadas', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.10', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1', '::ffff:a00:1', '0:0:0:0:0:ffff:0a00:0001', '[::1]', 'fe80::1%eth0', '64:ff9b::a00:1', 'no-es-ip']) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ['8.8.8.8', '172.32.0.1', '192.169.0.1', '2606:4700::1111', '2001:4860:4860::8888', '::ffff:808:808']) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it('en producción rechaza un host que resuelve a una IP privada y se conecta a la IP validada (sin DNS rebinding)', async () => {
    await expect(resolveSmtpTarget('smtp.example.com', { env: PRODUCTION, resolve: async () => ['10.0.0.5'] })).rejects.toThrow('smtp_host_not_allowed');
    await expect(resolveSmtpTarget('smtp.example.com', { env: PRODUCTION, resolve: async () => ['8.8.8.8', '192.168.0.1'] })).rejects.toThrow();
    await expect(resolveSmtpTarget('smtp.example.com', { env: PRODUCTION, resolve: async () => [] })).rejects.toThrow();
    await expect(resolveSmtpTarget('127.0.0.1', { env: PRODUCTION })).rejects.toThrow();
    await expect(resolveSmtpTarget('::ffff:a00:1', { env: PRODUCTION })).rejects.toThrow();
    await expect(resolveSmtpTarget('smtp.example.com', { env: PRODUCTION, resolve: async () => ['8.8.8.8'] })).resolves.toEqual({
      connectTo: '8.8.8.8',
      servername: 'smtp.example.com',
    });
    await expect(resolveSmtpTarget('8.8.4.4', { env: PRODUCTION })).resolves.toEqual({ connectTo: '8.8.4.4' });
  });

  it('en desarrollo o con SMTP_ALLOW_PRIVATE_HOSTS=true se permite (Mailpit) y se conecta por nombre', async () => {
    expect(privateHostsAllowed({ NODE_ENV: 'development' })).toBe(true);
    expect(privateHostsAllowed({ ...PRODUCTION, SMTP_ALLOW_PRIVATE_HOSTS: 'true' })).toBe(true);
    expect(privateHostsAllowed({ ...PRODUCTION, SMTP_ALLOW_PRIVATE_HOSTS: '1' })).toBe(false);
    await expect(resolveSmtpTarget('localhost', { env: { NODE_ENV: 'development' } })).resolves.toEqual({ connectTo: 'localhost' });
  });
});
