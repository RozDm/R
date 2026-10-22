import { describe, expect, it } from 'vitest'
import { clientKey, expandIpv6 } from '@/src/ip'

describe('clientKey', () => {
  it('keeps an IPv4 address as is', () => {
    expect(clientKey('203.0.113.7')).toBe('203.0.113.7')
  })

  it('gives every address of one IPv6 /64 the same key, compressed or not', () => {
    const key = '2001:db8:aa:bb::/64'
    for (const ip of [
      '2001:db8:aa:bb::1',
      '2001:0db8:00aa:00bb:0000:0000:0000:0001',
      '2001:DB8:AA:BB:1234:5678:9abc:def0',
      '2001:db8:aa:bb:ffff::',
    ]) {
      expect(clientKey(ip), ip).toBe(key)
    }
  })

  it('separates neighbouring /64s and expands "::" before taking the prefix', () => {
    expect(clientKey('2001:db8:aa:bc::1')).toBe('2001:db8:aa:bc::/64')
    // Naively splitting '2001:db8::1' on ':' would key on "2001:db8::1".
    expect(clientKey('2001:db8::1')).toBe('2001:db8:0:0::/64')
    expect(clientKey('2001:db8::2')).toBe('2001:db8:0:0::/64')
    expect(clientKey('::1')).toBe('0:0:0:0::/64')
  })

  it('maps an IPv4-mapped IPv6 address back to IPv4', () => {
    expect(clientKey('::ffff:198.51.100.4')).toBe('198.51.100.4')
    expect(clientKey('::ffff:c633:6404')).toBe('198.51.100.4')
  })

  it('passes anything unparseable through unchanged', () => {
    for (const junk of ['unknown', '1:2:3', '1::2::3', 'zz::1', '1:2:3:4:5:6:7:8:9', '::ffff:999.1.1.1']) {
      expect(clientKey(junk), junk).toBe(junk)
    }
  })
})

describe('expandIpv6', () => {
  it('expands to eight groups without leading zeros', () => {
    expect(expandIpv6('2001:db8::1')).toEqual(['2001', 'db8', '0', '0', '0', '0', '0', '1'])
    expect(expandIpv6('::')).toEqual(['0', '0', '0', '0', '0', '0', '0', '0'])
    expect(expandIpv6('64:ff9b::192.0.2.1')).toEqual(['64', 'ff9b', '0', '0', '0', '0', 'c000', '201'])
  })

  it('refuses "::" standing for no group at all', () => {
    expect(expandIpv6('1:2:3:4:5:6:7::8')).toBeNull()
  })
})
