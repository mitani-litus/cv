import { isValidIsoDate } from '@cv/schema';

/**
 * 満年齢を計算する（誕生日当日に1歳加える）。
 * 2月29日生まれの人は、うるう年でない年は3月1日に1歳加える。
 * どちらかの日付が不正、または生年月日が基準日より後の場合は null。
 */
export function calcAge(birthDate: string, onDate: string): number | null {
  if (!isValidIsoDate(birthDate) || !isValidIsoDate(onDate) || birthDate > onDate) return null;
  const [by, bmd] = [Number(birthDate.slice(0, 4)), birthDate.slice(5)];
  const [oy, omd] = [Number(onDate.slice(0, 4)), onDate.slice(5)];
  return oy - by - (omd < bmd ? 1 : 0);
}
