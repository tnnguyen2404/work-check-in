export function calculateWorkedMinutes(
  checkInISO: string,
  checkOutISO: string
) 

{
  return Math.floor(
    (new Date(checkOutISO).getTime() -
      new Date(checkInISO).getTime()) / 60000
  );
}