import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isPrivateIp, normalizeIpForCheck } from '../../server/utils/netGuard.js'

// S5/L5: 私网与保留地址判定全集
test('netGuard: SSRF 向量全部判定为私网', () => {
  const privateVectors = [
    '127.0.0.1', '10.0.0.1', '192.168.1.1', '172.16.0.1', '172.31.255.1',
    '169.254.169.254', '100.64.0.1', '0.0.0.0', '0.1.2.3',
    '224.0.0.1', '239.255.255.1', '240.0.0.1', '255.255.255.255',
    '192.0.0.8', '192.0.2.1', '198.18.0.1', '198.19.255.1',
    '::', '::1',
    '[::1]', '[::ffff:127.0.0.1]', '::ffff:127.0.0.1', '::ffff:7f00:1',
    '::ffff:10.0.0.5', '::ffff:a00:5', '::127.0.0.1',
    '2002:7f00:1', '64:ff9b::7f00:1',
    'fc00::1', 'fd12::1', 'fe80::1', 'fec0::1',
    '', null, undefined
  ]
  for (const v of privateVectors) {
    assert.equal(isPrivateIp(v), true, `应判定私网: ${v}`)
  }
})

test('netGuard: 公网地址不误伤', () => {
  const publicVectors = ['8.8.8.8', '1.1.1.1', '216.23.81.239', '172.32.0.1', '172.15.255.1', '100.63.0.1', '100.128.0.1', '2606:4700::1', '2a0e:97c0::1']
  for (const v of publicVectors) {
    assert.equal(isPrivateIp(v), false, `不应判定私网: ${v}`)
  }
})

test('netGuard: normalizeIpForCheck 剥离 IPv6 方括号', () => {
  assert.equal(normalizeIpForCheck('[::1]'), '::1')
  assert.equal(normalizeIpForCheck('::1'), '::1')
})
