
declare global {
  const google: any;
}

export const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

export let tokenClient: any = null;
export let accessToken: string | null = null;

