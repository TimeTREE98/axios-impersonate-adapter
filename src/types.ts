import 'axios';

import type { CookieJar } from 'tough-cookie';

import { Profile } from './impersonate';

declare module 'axios' {
  export interface AxiosRequestConfig {
    impersonate?: Profile;
    jar?: CookieJar;
  }
}
