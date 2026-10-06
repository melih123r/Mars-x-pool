package com.marsx.pool;

import android.app.Activity;
import android.os.CancellationSignal;

import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;

import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import java.util.concurrent.Executor;

final class GoogleSignInManager {
    interface Callback {
        void onToken(String idToken);
        void onError(String message);
    }

    private final Activity activity;
    private final CredentialManager credentialManager;

    GoogleSignInManager(Activity activity) {
        this.activity = activity;
        this.credentialManager = CredentialManager.create(activity);
    }

    boolean isConfigured() {
        return BuildConfig.GOOGLE_WEB_CLIENT_ID != null
                && BuildConfig.GOOGLE_WEB_CLIENT_ID.matches("[0-9]+-[A-Za-z0-9_-]+\\.apps\\.googleusercontent\\.com");
    }

    void signIn(String nonce, boolean silent, Callback callback) {
        if (!isConfigured()) {
            callback.onError("not_configured");
            return;
        }
        GetGoogleIdOption googleOption = new GetGoogleIdOption.Builder()
                .setFilterByAuthorizedAccounts(silent)
                .setServerClientId(BuildConfig.GOOGLE_WEB_CLIENT_ID)
                .setAutoSelectEnabled(silent)
                .setNonce(nonce)
                .build();
        GetCredentialRequest request = new GetCredentialRequest.Builder()
                .addCredentialOption(googleOption)
                .build();
        Executor executor = activity::runOnUiThread;
        credentialManager.getCredentialAsync(
                activity,
                request,
                new CancellationSignal(),
                executor,
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override
                    public void onResult(GetCredentialResponse result) {
                        try {
                            Credential credential = result.getCredential();
                            if (!(credential instanceof CustomCredential)
                                    || !GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                                callback.onError("unexpected_credential");
                                return;
                            }
                            GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(credential.getData());
                            callback.onToken(google.getIdToken());
                        } catch (Exception error) {
                            callback.onError("token_parse_failed");
                        }
                    }

                    @Override
                    public void onError(GetCredentialException error) {
                        if (error instanceof NoCredentialException) {
                            callback.onError("silent_unavailable");
                        } else {
                            callback.onError(silent ? "silent_unavailable" : "cancelled");
                        }
                    }
                }
        );
    }
}
