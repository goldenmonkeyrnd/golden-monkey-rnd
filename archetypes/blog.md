+++
title = {{ replace .File.ContentBaseName "-" " " | title | jsonify }}
date = {{ .Date | jsonify }}
draft = true
description = ""
+++
