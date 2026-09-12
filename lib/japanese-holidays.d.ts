declare module 'japanese-holidays' {
  const holidays: {
    isHoliday(date: Date): string | undefined;
  };
  export default holidays;
}
