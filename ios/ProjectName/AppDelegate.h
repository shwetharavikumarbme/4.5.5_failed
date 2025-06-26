#import "RCTAppDelegate.h" // ✅ Direct local import
// ✅ Add this if missing
#import <UserNotifications/UserNotifications.h>
#import <FirebaseMessaging/FirebaseMessaging.h>

@interface AppDelegate : RCTAppDelegate <UNUserNotificationCenterDelegate, FIRMessagingDelegate>
@end
