#import "AppDelegate.h"
#import <Firebase.h>
#import <React/RCTBundleURLProvider.h>
#import <UserNotifications/UserNotifications.h>
#import <FirebaseMessaging/FirebaseMessaging.h>
#import <React/RCTBridge.h>
#import <React/RCTRootView.h>
#import <React/RCTLinkingManager.h>
#import <AVFoundation/AVFoundation.h>
#import "RNShortcuts.h"

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];

  // 1. Setup audio session
  NSError *audioSessionError = nil;
  [[AVAudioSession sharedInstance] setCategory:AVAudioSessionCategoryPlayback error:&audioSessionError];
  [[AVAudioSession sharedInstance] setActive:YES error:nil];

  // 2. Configure Firebase
  if (![FIRApp defaultApp]) {
    [FIRApp configure];
  }

  // 3. Firebase Messaging setup
  [FIRMessaging messaging].delegate = self;
  [[FIRMessaging messaging] setAutoInitEnabled:YES];

  // 4. Notification setup
  if (@available(iOS 10, *)) {
    UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
    center.delegate = self;
    [center requestAuthorizationWithOptions:(UNAuthorizationOptionAlert + UNAuthorizationOptionSound + UNAuthorizationOptionBadge)
                          completionHandler:^(BOOL granted, NSError * _Nullable error) {
      if (granted) {
        dispatch_async(dispatch_get_main_queue(), ^{
          [application registerForRemoteNotifications];
        });
      }
    }];
  } else {
    UIUserNotificationSettings *settings = [UIUserNotificationSettings settingsForTypes:
      (UIUserNotificationTypeSound | UIUserNotificationTypeAlert | UIUserNotificationTypeBadge)
      categories:nil];
    [application registerUserNotificationSettings:settings];
    [application registerForRemoteNotifications];
  }

  // 5. React Native root view setup
  RCTBridge *bridge = [[RCTBridge alloc] initWithDelegate:self launchOptions:launchOptions];
  RCTRootView *rootView = [[RCTRootView alloc] initWithBridge:bridge moduleName:@"ProjectName" initialProperties:nil];
  rootView.backgroundColor = [UIColor whiteColor];

  UIViewController *rootViewController = [UIViewController new];
  rootViewController.view = rootView;
  self.window.rootViewController = rootViewController;
  [self.window makeKeyAndVisible];

  // 6. Quick Actions handling - Check if app was launched from quick action
  UIApplicationShortcutItem *shortcutItem = [launchOptions objectForKey:UIApplicationLaunchOptionsShortcutItemKey];
  if (shortcutItem) {
    [RNShortcuts handleShortcutItem:shortcutItem];
    return YES;
  }

  return YES;
}

#pragma mark - Quick Actions Handling (Updated)

- (void)application:(UIApplication *)application performActionForShortcutItem:(UIApplicationShortcutItem *)shortcutItem completionHandler:(void (^)(BOOL))completionHandler {
  // Send to both RNShortcuts and post a notification for redundancy
  [RNShortcuts handleShortcutItem:shortcutItem];
  [[NSNotificationCenter defaultCenter] postNotificationName:@"QuickActionPressed"
                                                    object:nil
                                                  userInfo:shortcutItem.userInfo];
  completionHandler(YES);
}

#pragma mark - Push Notifications (Existing)

- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken
{
  [FIRMessaging messaging].APNSToken = deviceToken;

  #ifdef DEBUG
    [[FIRMessaging messaging] setAPNSToken:deviceToken type:FIRMessagingAPNSTokenTypeSandbox];
  #else
    [[FIRMessaging messaging] setAPNSToken:deviceToken type:FIRMessagingAPNSTokenTypeProd];
  #endif

  [[FIRMessaging messaging] tokenWithCompletion:^(NSString *token, NSError *error) {
    if (token && !error) {
      NSLog(@"[FCM Token]: %@", token);
    }
  }];
}

- (void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error
{
  NSLog(@"[Push Notification Error]: %@", error);
}

- (void)messaging:(FIRMessaging *)messaging didReceiveRegistrationToken:(NSString *)fcmToken
{
  NSLog(@"[FCM Token Updated]: %@", fcmToken);
}

#pragma mark - UNUserNotificationCenterDelegate (Existing)

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
       willPresentNotification:(UNNotification *)notification
         withCompletionHandler:(void (^)(UNNotificationPresentationOptions options))completionHandler
{
  completionHandler(UNNotificationPresentationOptionBadge);
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void(^)(void))completionHandler
{
  completionHandler();
}

#pragma mark - React Native Bundle Loading (Existing)

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

#pragma mark - Deep Linking (Existing)

- (BOOL)application:(UIApplication *)application
continueUserActivity:(NSUserActivity *)userActivity
 restorationHandler:(void (^)(NSArray * _Nullable))restorationHandler
{
  if ([userActivity.activityType isEqualToString:NSUserActivityTypeBrowsingWeb]) {
    NSURL *url = userActivity.webpageURL;
    if (url) {
      return [RCTLinkingManager application:application
                       continueUserActivity:userActivity
                         restorationHandler:restorationHandler];
    }
  }
  return NO;
}

- (BOOL)application:(UIApplication *)application
            openURL:(NSURL *)url
            options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options
{
  return [RCTLinkingManager application:application openURL:url options:options];
}

@end
