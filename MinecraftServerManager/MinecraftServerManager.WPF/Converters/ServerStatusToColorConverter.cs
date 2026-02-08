using System.Globalization;
using System.Windows.Data;
using System.Windows.Media;

namespace MinecraftServerManager.WPF.Converters;

/// <summary>
/// Converts server running status to color (running = Green, stopped = Red, unknown = Yellow)
/// </summary>
public class ServerStatusToColorConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is bool isRunning)
        {
            return isRunning ? Brushes.LimeGreen : Brushes.Crimson;
        }
        return Brushes.Gold; // Unknown status
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}
