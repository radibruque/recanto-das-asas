package br.com.recantodasasas.app;

import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Delegates Back to the current record. Home/minimize never destroys the private session. */
@CapacitorPlugin(name = "RecantoNavigation")
public class RecantoNavigationPlugin extends Plugin {
    private OnBackPressedCallback callback;

    @Override
    public void load() {
        callback = new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (hasListeners("backRequested")) notifyListeners("backRequested", new JSObject());
                else getActivity().moveTaskToBack(true);
            }
        };
        getActivity().getOnBackPressedDispatcher().addCallback(getActivity(), callback);
    }

    @PluginMethod
    public void minimizeApp(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            boolean minimized = getActivity().moveTaskToBack(true);
            JSObject result = new JSObject();
            result.put("minimized", minimized);
            call.resolve(result);
        });
    }

    /** Invoked only by an explicit user exit after the JS session has been locked. */
    @PluginMethod
    public void finishApp(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            call.resolve();
            getActivity().finishAndRemoveTask();
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (callback != null) callback.remove();
    }
}
