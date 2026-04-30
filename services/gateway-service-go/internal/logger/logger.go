package logger

import (
	"fmt"
	"os"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	ColorReset  = "\033[0m"
	ColorRed    = "\033[31m"
	ColorGreen  = "\033[32m"
	ColorYellow = "\033[33m"
	ColorBlue   = "\033[34m"
	ColorPurple = "\033[35m"
	ColorCyan   = "\033[36m"
	ColorGray   = "\033[37m"
)

type Logger struct {
	context string
}

func New(context string) *Logger {
	return &Logger{context: context}
}

func (l *Logger) formatMessage(level string, color string, message string, args ...interface{}) string {
	pid := os.Getpid()
	now := time.Now().Format("01/02/2006, 3:04:05 PM")
	var formattedMessage string
	if len(args) > 0 {
		formattedMessage = fmt.Sprintf(message, args...)
	} else {
		formattedMessage = message
	}
	
	return fmt.Sprintf("%s[GatewayService] %d  - %s     %s %s[%s]%s %s%s",
		ColorGreen, pid, now, level, ColorYellow, l.context, color, formattedMessage, ColorReset)
}

func (l *Logger) Log(message string, args ...interface{}) {
	fmt.Println(l.formatMessage("LOG", ColorGreen, message, args...))
}

func (l *Logger) Error(message string, args ...interface{}) {
	fmt.Println(l.formatMessage("ERROR", ColorRed, message, args...))
}

func (l *Logger) Warn(message string, args ...interface{}) {
	fmt.Println(l.formatMessage("WARN", ColorYellow, message, args...))
}

func (l *Logger) Debug(message string, args ...interface{}) {
	fmt.Println(l.formatMessage("DEBUG", ColorPurple, message, args...))
}

func (l *Logger) Verbose(message string, args ...interface{}) {
	fmt.Println(l.formatMessage("VERBOSE", ColorCyan, message, args...))
}

func (l *Logger) Fatal(message string, args ...interface{}) {
	fmt.Println(l.formatMessage("ERROR", ColorRed, message, args...))
	os.Exit(1)
}

// GinLogger creates a Gin middleware that logs like NestJS
func GinLogger(context string) gin.HandlerFunc {
	l := New(context)
	return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		statusColor := param.StatusCodeColor()
		methodColor := param.MethodColor()
		resetColor := param.ResetColor()

		if param.Latency > time.Minute {
			param.Latency = param.Latency.Truncate(time.Second)
		}

		msg := fmt.Sprintf("%s%s%s %s %s %d %s %s",
			methodColor, param.Method, resetColor,
			param.Path,
			statusColor, param.StatusCode, resetColor,
			param.Latency,
		)

		if target, ok := param.Keys["proxyTarget"].(string); ok {
			msg = fmt.Sprintf("%s -> %s%s%s", msg, ColorCyan, target, ColorReset)
		}

		if param.ErrorMessage != "" {
			msg = fmt.Sprintf("%s %sERROR: %s%s", msg, ColorRed, param.ErrorMessage, ColorReset)
		}
		
		return l.formatMessage("LOG", ColorGreen, msg) + "\n"
	})
}
