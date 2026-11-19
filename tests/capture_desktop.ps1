param([int]$Left, [int]$Top, [int]$Width, [int]$Height, [string]$Output)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type 'using System.Runtime.InteropServices; public static class VeronaCaptureDpi { [DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); }'
[void][VeronaCaptureDpi]::SetProcessDPIAware()
$bitmap = New-Object System.Drawing.Bitmap($Width, $Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
    $graphics.CopyFromScreen($Left, $Top, 0, 0, $bitmap.Size)
    foreach ($point in @(@(4,4),@(($Width-5),4),@(4,($Height-5)),@(($Width-5),($Height-5)))) {
        $color = $bitmap.GetPixel($point[0], $point[1])
        if ($color.R -ne 37 -or $color.G -ne 103 -or $color.B -ne 71) {
            throw 'Native transparent corner did not reveal the owned background fixture; screenshot not saved.'
        }
    }
    $bitmap.Save($Output, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
    $graphics.Dispose()
    $bitmap.Dispose()
}
