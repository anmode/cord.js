import { BN, formatBalance } from '@polkadot/util'
import type {
  BalanceNumber,
  BalanceOptions,
  MetricPrefix,
} from '@cord.network/types'

export const WAY_UNIT = new BN(1)

export const Prefixes = new Map<MetricPrefix, number>([
  ['pico', -12],
  ['nano', -9],
  ['micro', -6],
  ['milli', -3],
  ['centi', -2],
  ['WAY', 0],
  ['kilo', 3],
  ['mega', 6],
  ['mill', 6],
  ['giga', 9],
  ['bill', 9],
  ['tera', 12],
  ['tril', 12],
  ['peta', 15],
  ['exa', 18],
  ['zetta', 21],
  ['yotta', 24],
])

/**
 * Uses the polkadot.js balance formatter, to convert given BN to a human readable prefixed number.
 *
 * @param amount BN to format.
 * @param additionalOptions Optional formatting settings, these are defaulted to CORD specific settings.
 * @returns String representation of the given BN with prefix and unit ('WAY' as default).
 */
export function formatWayBalance(
  amount: BalanceNumber,
  additionalOptions?: BalanceOptions
): string {
  const options = {
    decimals: 12,
    withSiFull: true,
    withUnit: 'WAY',
    ...additionalOptions,
  }
  return formatBalance(amount, options)
}

/**
 * Converts balance from WAY denomination to base unit.
 *
 * @param balance Balance in WAY denomination.
 * @param power Allows modifying conversion. Set to 0 for conversion to base unit, set to <0 for various larger denominations. -12 is WAY denomination.
 * @returns Converted (redenominated) balance.
 */
export function convertToTxUnit(balance: BN, power: number): BN {
  return new BN(balance).mul(new BN(10).pow(new BN(12 + power)))
}

export const TRANSACTION_FEE = convertToTxUnit(new BN(125), -9)

/**
 * Safely converts the given [[BalanceNumber]] to a string, using the supplied methods,
 * or it given a string checks for valid number representation.
 *
 * @param input [[BalanceNumber]] to convert.
 * @returns String representation of the given [[BalanceNumber]].
 * @throws On invalid number representation if given a string.
 * @throws On malformed input.
 */
export function balanceNumberToString(input: BalanceNumber): string {
  if (typeof input === 'string') {
    if (!input.match(/^-?\d*\.?\d+$/)) {
      throw new Error('not a string representation of number')
    }
    return input
  }
  if (
    typeof input === 'number' ||
    (typeof input === 'bigint' && input.toString) ||
    (typeof input === 'object' && input instanceof BN && input.toString)
  ) {
    return input.toString()
  }
  throw new Error('could not convert to String')
}

/**
 * Converts the given [[BalanceNumber]] to the pico WAY equivalent.
 *
 * @param input [[BalanceNumber]] to convert.
 * @param unit Metric prefix of the given [[BalanceNumber]].
 * @returns Exact BN representation in picoWay, to use in transactions and calculations.
 * @throws Unknown metricPrefix, or if the input has too many decimal places for it's unit.
 */
export function toPicoWay(
  input: BalanceNumber,
  unit: MetricPrefix = 'WAY'
): BN {
  const stringRepresentation = balanceNumberToString(input)

  if (!Prefixes.has(unit)) {
    throw new Error('Unknown metric prefix')
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const unitVal = Prefixes.get(unit)!
  const negative = stringRepresentation.substring(0, 1) === '-'

  const [integer, fraction] = negative
    ? stringRepresentation.substring(1).split('.')
    : stringRepresentation.split('.')
  if (fraction && fraction.length > unitVal + 12) {
    throw new Error(
      `Too many decimal places: input with unit ${unit} and value ${stringRepresentation} exceeds the ${
        unitVal + 12
      } possible decimal places by ${fraction.length - unitVal + 12}`
    )
  }
  const fractionBN = fraction
    ? convertToTxUnit(new BN(fraction), unitVal - fraction.length)
    : new BN(0)
  const resultingBN = convertToTxUnit(new BN(integer), unitVal).add(fractionBN)

  return resultingBN.mul(new BN(negative ? -1 : 1))
}

/**
 * Converts the given [[BalanceNumber]] to a human readable number with metric prefix and Unit.
 * This function uses the polkadot formatBalance function,
 * it's output can therefore be formatted via the polkadot formatting options.
 *
 * @param input [[BalanceNumber]] to convert from Pico WAY.
 * @param decimals Set the minimum decimal places in the formatted localized output, default is 4.
 * @param options [[BalanceOptions]] for internationalization and formatting.
 * @returns String representation of the given [[BalanceNumber]] with unit und metric prefix.
 */
export function fromPicoWay(
  input: BalanceNumber,
  decimals = 4,
  options: BalanceOptions = {}
): string {
  const inputBN = new BN(balanceNumberToString(input))
  // overwriting the locale as parsing a number from a string only works with English locale formatted numbers
  const formatted = formatWayBalance(inputBN, { ...options, locale: 'en' })
  const [number, ...rest] = formatted.split(' ')
  const localeNumber = new Intl.NumberFormat(options.locale, {
    minimumFractionDigits: decimals + 1,
    maximumFractionDigits: decimals + 1,
  }).format(Number(number))
  return `${localeNumber.slice(0, localeNumber.length - 1)} ${rest.join(' ')}`
}
