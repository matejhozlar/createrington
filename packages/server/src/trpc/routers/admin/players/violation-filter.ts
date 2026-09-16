type ViolationFilterInput = {
  hasStrikes?: boolean;
  hasBans?: boolean;
  hasViolations?: boolean;
  minecraftUuid?: string;
};

export function selectViolationUuids(
  input: ViolationFilterInput,
  uuidsWithStrikes: string[],
  uuidsWithBans: string[],
): string[] {
  let uuids: string[];

  if (input.hasViolations === true) {
    uuids = [...new Set([...uuidsWithStrikes, ...uuidsWithBans])];
  } else if (input.hasStrikes === true && input.hasBans === true) {
    uuids = uuidsWithStrikes.filter((uuid) => uuidsWithBans.includes(uuid));
  } else if (input.hasStrikes === true) {
    uuids = uuidsWithStrikes;
  } else if (input.hasBans === true) {
    uuids = uuidsWithBans;
  } else {
    uuids = [];
  }

  const exact = input.minecraftUuid;
  return exact ? uuids.filter((uuid) => uuid === exact) : uuids;
}
