import 'axios';

import { Profile } from './impersonate';

declare module 'axios' {
  export interface AxiosRequestConfig {
    impersonate?: Profile;
  }
}
