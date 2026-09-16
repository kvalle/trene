const fs = require('fs');
const path = require('path');

describe('active workout notification native resource', () => {
  const moduleRoot = path.join(__dirname, '..');
  const iconPath = path.join(
    moduleRoot,
    'android/src/main/res/drawable/ic_trene_notification.xml',
  );
  const modulePath = path.join(
    moduleRoot,
    'android/src/main/java/com/kjetilvalle/trene/activeworkoutnotification/ActiveWorkoutNotificationModule.kt',
  );

  it('packages and references the Trene monochrome notification icon', () => {
    const icon = fs.readFileSync(iconPath, 'utf8');
    const nativeModule = fs.readFileSync(modulePath, 'utf8');

    expect(icon).toContain('android:width="24dp"');
    expect(icon).toContain('android:height="24dp"');
    expect(icon).toContain('android:fillColor="#FFFFFFFF"');
    expect(nativeModule).toContain(
      '.setSmallIcon(R.drawable.ic_trene_notification)',
    );
    expect(nativeModule).not.toContain('android.R.drawable');
  });
});
