import { danger, schedule, warn } from 'danger';
import todos from 'danger-plugin-todos';

const packageChanged = danger.git.modified_files.find((x) =>
  x.includes('package.json'),
);
const lockfileChanged = danger.git.modified_files.find((x) =>
  x.includes('yarn.lock'),
);
if (packageChanged && !lockfileChanged) {
  const message = 'Changes were made to package.json, but not to yarn.lock';
  const idea = 'Perhaps you need to run `yarn install`?';
  warn(`${message} - <i>${idea}</i>`);
}

const envExampleChanged = danger.git.modified_files.find((x) =>
  x.includes('.env.example'),
);

if (envExampleChanged) {
  const message = 'Changes were made to .env.example';
  const idea =
    'Please make sure any new environment variables are properly documented with metadata in config-variables.ts';
  warn(`${message} - <i>${idea}</i>`);
}

schedule(todos());
