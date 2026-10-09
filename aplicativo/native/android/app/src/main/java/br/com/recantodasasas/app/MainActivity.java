package br.com.recantodasasas.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RecantoFilesPlugin.class);
        registerPlugin(RecantoCalendarPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
