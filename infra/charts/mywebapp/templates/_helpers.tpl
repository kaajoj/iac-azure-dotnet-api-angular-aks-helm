{{- define "mywebapp.name" -}}
{{- default .Chart.Name .Values.nameOverride }}
{{- end -}}

{{- define "mywebapp.fullname" -}}
{{- printf "%s-%s" (include "mywebapp.name" .) .Release.Name | trunc 63 | trimSuffix "-" }}
{{- end -}}

{{- define "mywebapp.client.fullname" -}}
{{- printf "%s-client-%s" (include "mywebapp.name" .) .Release.Name | trunc 63 | trimSuffix "-" }}
{{- end -}}
