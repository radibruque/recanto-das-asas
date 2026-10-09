package br.com.recantodasasas.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.provider.CalendarContract;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** User-confirmed calendar insertion. No calendar database access or background permissions. */
@CapacitorPlugin(name = "RecantoCalendar")
public class RecantoCalendarPlugin extends Plugin {
    @PluginMethod
    public void addEvent(PluginCall call) {
        String title = call.getString("title", "");
        String description = call.getString("description", "");
        Double beginValue = call.getDouble("beginTime");
        Double endValue = call.getDouble("endTime");
        Integer minutes = call.getInt("reminderMinutes", 15);
        if (title.trim().isEmpty() || title.length() > 150 || description.length() > 3000 ||
            beginValue == null || endValue == null || !Double.isFinite(beginValue) || !Double.isFinite(endValue) ||
            beginValue <= System.currentTimeMillis() || endValue <= beginValue || endValue - beginValue > 86400000 ||
            beginValue > 253402300799000L || endValue > 253402300799000L ||
            minutes == null || !(minutes == 0 || minutes == 5 || minutes == 15 || minutes == 30 || minutes == 60 || minutes == 1440)) {
            call.reject("Confira a data, o horário futuro e os dados do lembrete.", "E_CALENDAR_DATA");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_INSERT)
            .setData(CalendarContract.Events.CONTENT_URI)
            .putExtra(CalendarContract.Events.TITLE, title)
            .putExtra(CalendarContract.Events.DESCRIPTION, description)
            .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, beginValue.longValue())
            .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, endValue.longValue())
            .putExtra(CalendarContract.EXTRA_EVENT_ALL_DAY, false)
            .putExtra(CalendarContract.Events.EVENT_TIMEZONE, "America/Sao_Paulo")
            .putExtra(CalendarContract.Events.HAS_ALARM, true)
            // Some calendar apps ignore these extras. The user must confirm the reminder in the editor.
            .putExtra(CalendarContract.Reminders.MINUTES, minutes)
            .putExtra(CalendarContract.Reminders.METHOD, CalendarContract.Reminders.METHOD_ALERT);
        getActivity().runOnUiThread(() -> {
            try {
                getActivity().startActivity(intent);
                JSObject result = new JSObject();
                result.put("opened", true);
                call.resolve(result); // Opening is not confirmation that an event was saved.
            } catch (ActivityNotFoundException error) {
                call.reject("Não há calendário compatível no telefone. Instale um calendário ou baixe o lembrete .ics.", "E_NO_CALENDAR");
            } catch (Exception error) {
                call.reject("Não foi possível abrir o calendário. Você pode baixar o lembrete .ics.", "E_CALENDAR");
            }
        });
    }
}
