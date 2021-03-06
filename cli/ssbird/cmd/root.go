package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "ssbird",
	Short: "CLI for SSBird, master data management tool",
	Long: `This is the CLI for SSBird, master data management tool.
This CLI can reflect csv data to Spreadsheet.
It is intended to be used on CI/CD pipeline.`,
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
