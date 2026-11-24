package com.marsx.pool;

import android.app.ActivityManager;
import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.lang.reflect.Field;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Protocol;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.junit.Test;
import org.junit.runner.RunWith;
import sx.proxies.peer.ProxiesPeerSDK;
import static org.junit.Assert.*;

/** Exercise the pinned SDK on Android. All HTTP terminates in an in-process interceptor. */
@RunWith(AndroidJUnit4.class)
public class PrivateEnrollmentStopTest {
    @Test public void delayedRegistrationAndRefreshCannotReviveStoppedService() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        CountDownLatch register = new CountDownLatch(1), finishRegister = new CountDownLatch(1);
        CountDownLatch refresh = new CountDownLatch(1), finishRefresh = new CountDownLatch(1);
        AtomicBoolean unexpected = new AtomicBoolean(false);
        OkHttpClient transport = new OkHttpClient.Builder().addInterceptor(chain -> {
            String path = chain.request().url().encodedPath();
            String json = "{}";
            try {
                if (path.equals("/v1/peer/register")) {
                    register.countDown();
                    if (!finishRegister.await(8, TimeUnit.SECONDS)) throw new java.io.IOException("register timeout");
                    json = "{\"device\":{\"deviceId\":\"test-device\"},\"token\":\"test-access\",\"refreshToken\":\"test-refresh\"}";
                } else if (path.equals("/v1/peer/token/test-device/refresh")) {
                    refresh.countDown();
                    if (!finishRefresh.await(8, TimeUnit.SECONDS)) throw new java.io.IOException("refresh timeout");
                    json = "{\"token\":\"test-renewed\"}";
                } else if (!path.contains("/earnings/")) {
                    unexpected.set(true);
                }
            } catch (InterruptedException interruption) {
                Thread.currentThread().interrupt();
                throw new java.io.IOException(interruption);
            }
            return new Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1)
                .code(200).message("fixture").body(ResponseBody.create(MediaType.get("application/json"),json)).build();
        }).build();
        ProxiesPeerSDK.Config config = new ProxiesPeerSDK.Config("https://fixture.invalid/v1",null,null,null,null);
        ProxiesPeerSDK sdk = ProxiesPeerSDK.init(context, "", config);
        Field client = ProxiesPeerSDK.class.getDeclaredField("client");
        client.setAccessible(true);
        client.set(sdk, transport);
        try {
            sdk.start();
            assertTrue("official register route",register.await(8,TimeUnit.SECONDS));
            sdk.stop();
            finishRegister.countDown();
            Field token = ProxiesPeerSDK.class.getDeclaredField("refreshTokenValue");
            token.setAccessible(true);
            for (int n=0; n<100 && token.get(sdk)==null; n++) Thread.sleep(50);
            assertEquals("test-refresh",token.get(sdk));
            sdk.start();
            assertTrue("persisted device uses refresh",refresh.await(8,TimeUnit.SECONDS));
            sdk.stop();
            finishRefresh.countDown();
            Field access = ProxiesPeerSDK.class.getDeclaredField("deviceToken");
            access.setAccessible(true);
            for (int n=0; n<100 && !"test-renewed".equals(access.get(sdk)); n++) Thread.sleep(50);
            assertEquals("test-renewed",access.get(sdk));
            assertEquals(ProxiesPeerSDK.Status.STOPPED,sdk.getStatus());
            ActivityManager services = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
            for (ActivityManager.RunningServiceInfo service : services.getRunningServices(100)) {
                assertFalse(service.service.getClassName().endsWith(".PeerProxyService"));
            }
            assertFalse("unexpected SDK route", unexpected.get());
        } finally {
            finishRegister.countDown();
            finishRefresh.countDown();
            sdk.stop();
        }
    }
}
