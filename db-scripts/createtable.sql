USE [auditlogs]
GO

ALTER TABLE [dbo].[GR_TB_LOGIN_TRACKING] DROP CONSTRAINT [DF_GR_TB_LOGIN_TRACKING_is_cloud_login]
GO

ALTER TABLE [dbo].[GR_TB_LOGIN_TRACKING] DROP CONSTRAINT [DF_GR_TB_LOGIN_TRACKING_is_fail]
GO

ALTER TABLE [dbo].[GR_TB_LOGIN_TRACKING] DROP CONSTRAINT [DF_GR_TB_LOGIN_TRACKING_created]
GO

/****** Object:  Table [dbo].[GR_TB_LOGIN_TRACKING]    Script Date: 1/5/2024 2:15:20 PM ******/
IF  EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[GR_TB_LOGIN_TRACKING]') AND type in (N'U'))
DROP TABLE [dbo].[GR_TB_LOGIN_TRACKING]
GO

/****** Object:  Table [dbo].[GR_TB_LOGIN_TRACKING]    Script Date: 1/5/2024 2:15:20 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[GR_TB_LOGIN_TRACKING](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[terminal] [varchar](30) NOT NULL,
	[login_method] [varchar](8) NOT NULL,
	[login_type] [varchar](3) NOT NULL,
	[fail_details] [varchar](30) NULL,
	[from_dict_network_login] [bit] NULL,
	[from_dict_enabled_nexo] [bit] NULL,
	[from_dict_nexo_user] [varchar](30) NULL,
	[created] [datetime2](7) NOT NULL,
	[is_fail] [bit] NULL,
	[is_cloud_login] [bit] NULL,
	[fail_detail] [varchar](800) NULL,
	[login_date] [datetimeoffset](7) NULL,
	[username] [varchar](50) NULL,
	[ip] [varchar](20) NULL,
 CONSTRAINT [PK_GR_TB_LOGIN_TRACKING] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[GR_TB_LOGIN_TRACKING] ADD  CONSTRAINT [DF_GR_TB_LOGIN_TRACKING_created]  DEFAULT (getdate()) FOR [created]
GO

ALTER TABLE [dbo].[GR_TB_LOGIN_TRACKING] ADD  CONSTRAINT [DF_GR_TB_LOGIN_TRACKING_is_fail]  DEFAULT ((0)) FOR [is_fail]
GO

ALTER TABLE [dbo].[GR_TB_LOGIN_TRACKING] ADD  CONSTRAINT [DF_GR_TB_LOGIN_TRACKING_is_cloud_login]  DEFAULT ((0)) FOR [is_cloud_login]
GO


